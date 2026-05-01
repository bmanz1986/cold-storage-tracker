'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TASK_TYPES = [
  'Unloading',
  'Loading',
  'Temperature Check',
  'Inspection',
  'Quality Check',
  'Paperwork',
  'Putaway',
  'Other',
]

function nowLocal() {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.toISOString().slice(0, 16)
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [arrivals, setArrivals] = useState([])
  const [tasks, setTasks] = useState({})
  const [doorStatus, setDoorStatus] = useState({})

  const [vendorName, setVendorName] = useState('')
  const [truckPo, setTruckPo] = useState('')
  const [arrivedAt, setArrivedAt] = useState('')
  const [door, setDoor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [arrivalMessage, setArrivalMessage] = useState(null)

  const [addingTaskTo, setAddingTaskTo] = useState(null)
  const [taskName, setTaskName] = useState('Unloading')
  const [taskStarted, setTaskStarted] = useState('')
  const [taskEnded, setTaskEnded] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)

  const [clearing, setClearing] = useState(null)
  const router = useRouter()

  const fetchArrivals = useCallback(async () => {
    const { data } = await supabase
      .from('arrivals')
      .select('*')
      .order('arrived_at', { ascending: false })
      .limit(20)
    if (data) setArrivals(data)
  }, [])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('started_at', { ascending: true })
    if (data) {
      const byArrival = {}
      data.forEach(task => {
        if (!byArrival[task.arrival_id]) byArrival[task.arrival_id] = []
        byArrival[task.arrival_id].push(task)
      })
      setTasks(byArrival)
    }
  }, [])

  const fetchDoorStatus = useCallback(async () => {
    const { data } = await supabase
      .from('arrivals')
      .select('*')
      .not('door', 'is', null)
      .is('cleared_at', null)
      .order('arrived_at', { ascending: false })
    if (data) {
      const status = {}
      data.forEach(arrival => {
        if (!status[arrival.door]) status[arrival.door] = arrival
      })
      setDoorStatus(status)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        fetchArrivals()
        fetchDoorStatus()
        fetchTasks()
      }
    })
  }, [router, fetchArrivals, fetchDoorStatus, fetchTasks])

  async function handleArrivalSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setArrivalMessage(null)

    const timestamp = arrivedAt
      ? new Date(arrivedAt).toISOString()
      : new Date().toISOString()

    const { error } = await supabase.from('arrivals').insert({
      vendor_name: vendorName,
      truck_po: truckPo,
      arrived_at: timestamp,
      logged_by: user.id,
      door: door ? parseInt(door) : null,
    })

    if (error) {
      setArrivalMessage({ type: 'error', text: 'Error: ' + error.message })
    } else {
      setArrivalMessage({ type: 'success', text: 'Arrival logged!' })
      setVendorName('')
      setTruckPo('')
      setArrivedAt('')
      setDoor('')
      fetchArrivals()
      fetchDoorStatus()
    }
    setSubmitting(false)
  }

  function openTaskForm(arrivalId) {
    setAddingTaskTo(arrivalId)
    setTaskName('Unloading')
    setTaskStarted(nowLocal())
    setTaskEnded('')
  }

  async function handleTaskSubmit(e) {
    e.preventDefault()
    setSubmittingTask(true)

    const { error } = await supabase.from('tasks').insert({
      arrival_id: addingTaskTo,
      performed_by: user.id,
      performer_email: user.email,
      task_name: taskName,
      started_at: new Date(taskStarted).toISOString(),
      ended_at: taskEnded ? new Date(taskEnded).toISOString() : null,
    })

    if (!error) {
      setAddingTaskTo(null)
      fetchTasks()
    }
    setSubmittingTask(false)
  }

  async function clearDoor(arrivalId, doorNum) {
    setClearing(doorNum)
    const { data, error } = await supabase
      .from('arrivals')
      .update({ cleared_at: new Date().toISOString() })
      .eq('id', arrivalId)
      .select()
    if (error) {
      alert('Could not clear door: ' + error.message)
    } else if (!data || data.length === 0) {
      alert('Could not clear door — you may not have permission. Ask your admin to check Supabase RLS policies on the arrivals table.')
    } else {
      fetchDoorStatus()
      fetchArrivals()
    }
    setClearing(null)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Cold Storage Tracker</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">Reports</Link>
          <button onClick={handleSignOut} className="text-sm text-red-600 hover:underline">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Door Status Dashboard */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Door Status</h2>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(doorNum => {
              const occupied = doorStatus[doorNum]
              return (
                <div
                  key={doorNum}
                  className={`rounded-lg p-3 text-center ${
                    occupied ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                  }`}
                >
                  <p className="font-bold text-gray-700 text-sm">Door {doorNum}</p>
                  {occupied ? (
                    <>
                      <p className="text-xs text-gray-600 mt-1 truncate">{occupied.vendor_name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(occupied.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <button
                        onClick={() => clearDoor(occupied.id, doorNum)}
                        disabled={clearing === doorNum}
                        className="mt-2 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded disabled:opacity-50"
                      >
                        {clearing === doorNum ? '…' : 'Clear'}
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-green-600 mt-2 font-medium">Available</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Log Arrival Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Log New Arrival</h2>
          <form onSubmit={handleArrivalSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="e.g. Acme Farms"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Truck / PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={truckPo}
                onChange={e => setTruckPo(e.target.value)}
                placeholder="e.g. PO-1234"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Door <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={door}
                  onChange={e => setDoor(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select --</option>
                  {[1, 2, 3, 4, 5].map(d => (
                    <option key={d} value={d}>Door {d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Arrival Time <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={arrivedAt}
                  onChange={e => setArrivedAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {arrivalMessage && (
              <p className={`text-sm ${arrivalMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {arrivalMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving…' : 'Log Arrival'}
            </button>
          </form>
        </div>

        {/* Recent Arrivals with Tasks */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Arrivals</h2>
          {arrivals.length === 0 ? (
            <p className="text-gray-400 text-sm">No arrivals logged yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {arrivals.map((a, i) => (
                <li key={a.id ?? i} className="py-4">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{a.vendor_name}</p>
                      <p className="text-sm text-gray-500">
                        PO / Truck: {a.truck_po}
                        {a.door ? ` · Door ${a.door}` : ''}
                        {a.cleared_at ? ' · Cleared' : ''}
                      </p>
                    </div>
                    <p className="text-sm text-gray-400 whitespace-nowrap">
                      {new Date(a.arrived_at).toLocaleString()}
                    </p>
                  </div>

                  {tasks[a.id] && tasks[a.id].length > 0 && (
                    <ul className="ml-3 mb-2 space-y-1 border-l-2 border-gray-100 pl-3">
                      {tasks[a.id].map(t => (
                        <li key={t.id} className="text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{t.task_name}</span>
                          {' · '}{t.performer_email.split('@')[0]}
                          {' · '}{new Date(t.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {t.ended_at && ` – ${new Date(t.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </li>
                      ))}
                    </ul>
                  )}

                  {addingTaskTo === a.id ? (
                    <form onSubmit={handleTaskSubmit} className="mt-2 bg-gray-50 rounded-md p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Task</label>
                          <select
                            value={taskName}
                            onChange={e => setTaskName(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                          <input
                            type="datetime-local"
                            value={taskStarted}
                            onChange={e => setTaskStarted(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          End Time <span className="text-gray-400 font-normal">(optional — fill in when done)</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={taskEnded}
                          onChange={e => setTaskEnded(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={submittingTask}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {submittingTask ? 'Saving…' : 'Save Task'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingTaskTo(null)}
                          className="text-gray-500 px-3 py-1 rounded text-sm hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => openTaskForm(a.id)}
                      className="mt-1 text-xs text-blue-600 hover:underline"
                    >
                      + Add Task
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </main>
    </div>
  )
}
