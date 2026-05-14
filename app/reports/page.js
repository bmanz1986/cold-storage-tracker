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

function downloadCsv(filename, headers, rows) {
  const lines = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [arrivals, setArrivals] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
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

  const filteredArrivals = arrivals.filter(a => {
    const t = new Date(a.arrived_at)
    if (fromDate && t < new Date(fromDate + 'T00:00:00')) return false
    if (toDate && t > new Date(toDate + 'T23:59:59')) return false
    return true
  })
  const filteredArrivalIds = new Set(filteredArrivals.map(a => a.id))
  const filteredTasks = tasks.filter(t => filteredArrivalIds.has(t.arrival_id))

  // Vendor stats
  const vendorMap = {}
  filteredArrivals.forEach(a => {
    if (!vendorMap[a.vendor_name]) vendorMap[a.vendor_name] = { count: 0, dockTimes: [] }
    vendorMap[a.vendor_name].count++
    vendorMap[a.vendor_name].dockTimes.push(minutesBetween(a.arrived_at, a.cleared_at))
  })
  const vendorStats = Object.entries(vendorMap)
    .map(([name, d]) => ({ name, count: d.count, avgDock: average(d.dockTimes) }))
    .sort((a, b) => b.count - a.count)

  // Door stats
  const doorMap = {}
  filteredArrivals.filter(a => a.door).forEach(a => {
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
  filteredTasks.forEach(t => {
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

  const dateLabel = (fromDate || toDate)
    ? `${fromDate || 'start'}-to-${toDate || 'today'}`
    : 'all-time'

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Cold Storage Tracker — Reports</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => window.print()} className="text-sm text-gray-600 hover:underline">
            Print / Save PDF
          </button>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Date range filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filter by date:</span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate('') }} className="text-sm text-gray-400 hover:text-gray-600">
              Clear
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{filteredArrivals.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Arrivals</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{filteredTasks.length}</p>
            <p className="text-sm text-gray-500 mt-1">Tasks Logged</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{vendorStats.length}</p>
            <p className="text-sm text-gray-500 mt-1">Unique Vendors</p>
          </div>
        </div>

        {/* Vendor report */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">By Vendor</h2>
            <button
              onClick={() => downloadCsv(
                `vendors-${dateLabel}.csv`,
                ['Vendor', 'Arrivals', 'Avg Dock Time'],
                vendorStats.map(v => [v.name, v.count, formatMinutes(v.avgDock)])
              )}
              className="text-xs text-blue-600 hover:underline"
            >
              Export CSV
            </button>
          </div>
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">By Door</h2>
            <button
              onClick={() => downloadCsv(
                `doors-${dateLabel}.csv`,
                ['Door', 'Arrivals', 'Avg Occupancy'],
                doorStats.map(d => [`Door ${d.door}`, d.count, formatMinutes(d.avgDock)])
              )}
              className="text-xs text-blue-600 hover:underline"
            >
              Export CSV
            </button>
          </div>
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">By Team Member</h2>
            <button
              onClick={() => downloadCsv(
                `team-${dateLabel}.csv`,
                ['Team Member', 'Tasks', 'Avg Duration', 'Top Task'],
                memberStats.map(m => [m.name, m.count, formatMinutes(m.avgDuration), m.topTask])
              )}
              className="text-xs text-blue-600 hover:underline"
            >
              Export CSV
            </button>
          </div>
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
