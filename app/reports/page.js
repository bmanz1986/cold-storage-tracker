'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function minutesBetween(start, end) {
  if (!start || !end) return null
  return Math.round((new Date(end) - new Date(start)) / 60000)
}

function formatMinutes(mins) {
  if (mins === null || mins === undefined || isNaN(mins)) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function average(nums) {
  const valid = nums.filter(n => n !== null && !isNaN(n))
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

export default function ReportsPage() {
  const [arrivals, setArrivals] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      Promise.all([
        supabase.from('arrivals').select('*').order('arrived_at', { ascending: false }),
        supabase.from('tasks').select('*'),
      ]).then(([{ data: a }, { data: t }]) => {
        setArrivals(a || [])
        setTasks(t || [])
        setLoading(false)
      })
    })
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Loading reports…</p>
    </div>
  )

  // Vendor stats
  const vendorMap = {}
  arrivals.forEach(a => {
    if (!vendorMap[a.vendor_name]) vendorMap[a.vendor_name] = { count: 0, dockTimes: [] }
    vendorMap[a.vendor_name].count++
    vendorMap[a.vendor_name].dockTimes.push(minutesBetween(a.arrived_at, a.cleared_at))
  })
  const vendorStats = Object.entries(vendorMap)
    .map(([name, d]) => ({ name, count: d.count, avgDock: average(d.dockTimes) }))
    .sort((a, b) => b.count - a.count)

  // Door stats
  const doorMap = {}
  arrivals.filter(a => a.door).forEach(a => {
    if (!doorMap[a.door]) doorMap[a.door] = { count: 0, dockTimes: [] }
    doorMap[a.door].count++
    doorMap[a.door].dockTimes.push(minutesBetween(a.arrived_at, a.cleared_at))
  })
  const doorStats = [1, 2, 3, 4, 5].map(d => ({
    door: d,
    count: doorMap[d]?.count || 0,
    avgDock: average(doorMap[d]?.dockTimes || []),
  }))

  // Team member stats
  const memberMap = {}
  tasks.forEach(t => {
    const name = t.performer_email.split('@')[0]
    if (!memberMap[name]) memberMap[name] = { count: 0, durations: [], taskCounts: {} }
    memberMap[name].count++
    memberMap[name].durations.push(minutesBetween(t.started_at, t.ended_at))
    memberMap[name].taskCounts[t.task_name] = (memberMap[name].taskCounts[t.task_name] || 0) + 1
  })
  const memberStats = Object.entries(memberMap)
    .map(([name, d]) => ({
      name,
      count: d.count,
      avgDuration: average(d.durations),
      topTask: Object.entries(d.taskCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Cold Storage Tracker</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to Dashboard</Link>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{arrivals.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Arrivals</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{tasks.length}</p>
            <p className="text-sm text-gray-500 mt-1">Tasks Logged</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{vendorStats.length}</p>
            <p className="text-sm text-gray-500 mt-1">Unique Vendors</p>
          </div>
        </div>

        {/* Vendor report */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">By Vendor</h2>
          {vendorStats.length === 0 ? (
            <p className="text-gray-400 text-sm">No data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Vendor</th>
                  <th className="pb-2 font-medium text-right">Arrivals</th>
                  <th className="pb-2 font-medium text-right">Avg Dock Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vendorStats.map(v => (
                  <tr key={v.name}>
                    <td className="py-2 text-gray-800">{v.name}</td>
                    <td className="py-2 text-right text-gray-600">{v.count}</td>
                    <td className="py-2 text-right text-gray-600">{formatMinutes(v.avgDock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Door report */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">By Door</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Door</th>
                <th className="pb-2 font-medium text-right">Arrivals</th>
                <th className="pb-2 font-medium text-right">Avg Occupancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {doorStats.map(d => (
                <tr key={d.door}>
                  <td className="py-2 text-gray-800">Door {d.door}</td>
                  <td className="py-2 text-right text-gray-600">{d.count}</td>
                  <td className="py-2 text-right text-gray-600">{formatMinutes(d.avgDock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Team member report */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">By Team Member</h2>
          {memberStats.length === 0 ? (
            <p className="text-gray-400 text-sm">No tasks logged yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Team Member</th>
                  <th className="pb-2 font-medium text-right">Tasks</th>
                  <th className="pb-2 font-medium text-right">Avg Duration</th>
                  <th className="pb-2 font-medium text-right">Top Task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {memberStats.map(m => (
                  <tr key={m.name}>
                    <td className="py-2 text-gray-800">{m.name}</td>
                    <td className="py-2 text-right text-gray-600">{m.count}</td>
                    <td className="py-2 text-right text-gray-600">{formatMinutes(m.avgDuration)}</td>
                    <td className="py-2 text-right text-gray-600">{m.topTask}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
