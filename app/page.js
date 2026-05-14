'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const VENDORS = [
  'Dough Connection',
  'Dumpling Daughter',
  'Engo',
  'Farmers & Cooks',
  'Galleria',
  'Haddonfield',
  'Jessica',
  'Nashoba',
  "Papa's Catch",
  'Stuff Foods',
]

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

function toLocalInput(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [arrivals, setArrivals] = useState([])
  const [tasks, setTasks] = useState({})
  const [doorStatus, setDoorStatus] = useState({})
  const [search, setSearch] = useState('')

  const [vendorName, setVendorName] = useState('')
  const [truckNumber, setTruckNumber] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [arrivedAt, setArrivedAt] = useState('')
  const [door, setDoor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [arrivalMessage, setArrivalMessage] = useState(null)

  const [truckNumbers, setTruckNumbers] = useState([])

  const [editingArrival, setEditingArrival] = useState(null)
  const [editVendor, setEditVendor] = useState('')
  const [editTruckNum, setEditTruckNum] = useState('')
  const [editPoNum, setEditPoNum] = useState('')
  const [editDoor, setEditDoor] = useState('')
  const [editTime, setEditTime] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [addingTaskTo, setAddingTaskTo] = useState(null)
  const [taskName, setTaskName] = useState('Unloading')
  const [taskStarted, setTaskStarted] = useState('')
  const [taskEnded, setTaskEnded] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)

  const [editingTaskEnd, setEditingTaskEnd] = useState(null)
  const [taskEndValue, setTaskEndValue] = useState('')

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
        supabase.from('arrivals').select('truck_number').then(({ data }) => {
          if (data) setTruckNumbers([...new Set(data.map(r => r.truck_number).filter(Boolean))].sort())
        })
      }
    })
  }, [router, fetchArrivals, fetchDoorStatus, fetchTasks])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrivals' }, () => {
        fetchArrivals()
        fetchDoorStatus()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchArrivals, fetchDoorStatus, fetchTasks])

  async function handleArrivalSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setArrivalMessage(null)
    const timestamp = arrivedAt ? new Date(arrivedAt).toISOString() : new Date().toISOString()
    const { error } = await supabase.from('arrivals').insert({
      vendor_name: vendorName,
      truck_number: truckNumber,
      po_number: poNumber || null,
      arrived_at: timestamp,
      logged_by: user.id,
      door: door ? parseInt(door) : null,
    })
    if (error) {
      setArrivalMessage({ type: 'error', text: 'Error: ' + error.message })
    } else {
      setArrivalMessage({ type: 'success', text: 'Arrival logged!' })
      setVendorName('')
      setTruckNumber('')
      setPoNumber('')
      setArrivedAt('')
      setDoor('')
      setTruckNumbers(prev => [...new Set([...prev, truckNumber])].sort())
      fetchArrivals()
      fetchDoorStatus()
    }
    setSubmitting(false)
  }

  function openEditArrival(a) {
    setEditingArrival(a.id)
    setEditVendor(a.vendor_name)
    setEditTruckNum(a.truck_number || a.truck_po || '')
    setEditPoNum(a.po_number || '')
    setEditDoor(a.door ? String(a.door) : '')
    setEditTime(toLocalInput(a.arrived_at))
  }

  async function handleSaveArrival(e) {
    e.preventDefault()
    setSavingEdit(true)
    const { error } = await supabase.from('arrivals').update({
      vendor_name: editVendor,
      truck_number: editTruckNum,
      po_number: editPoNum || null,
      door: editDoor ? parseInt(editDoor) : null,
      arrived_at: new Date(editTime).toISOString(),
    }).eq('id', editingArrival)
    if (!error) {
      setEditingArrival(null)
      fetchArrivals()
      fetchDoorStatus()
    } else {
      alert('Could not save: ' + error.message)
    }
    setSavingEdit(false)
  }

  async function deleteArrival(id) {
    if (!window.confirm('Delete this arrival and all its tasks?')) return
    await supabase.from('tasks').delete().eq('arrival_id', id)
    const { error } = await supabase.from('arrivals').delete().eq('id', id)
    if (error) {
      alert('Could not delete: ' + error.message)
    } else {
      fetchArrivals()
      fetchDoorStatus()
      fetchTasks()
    }
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

  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return
    const { data, error } = await supabase.from('tasks').delete().eq('id', id).select()
    if (error) {
      alert('Could not delete: ' + error.message)
    } else if (!data || data.length === 0) {
      alert('Delete was blocked — a permission rule in Supabase is preventing it. See instructions to fix.')
    } else {
      fetchTasks()
    }
  }

  async function saveTaskEnd(taskId) {
    const { error } = await supabase.from('tasks').update({
      ended_at: new Date(taskEndValue).toISOString(),
    }).eq('id', taskId)
    if (!error) {
      setEditingTaskEnd(null)
      fetchTasks()
    } else {
      alert('Could not save: ' + error.message)
    }
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

  const filteredArrivals = search.trim()
    ? arrivals.filter(a => a.vendor_name.toLowerCase().includes(search.toLowerCase()))
    : arrivals

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Cold Storage Tracker</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">Reports</Link>
          <button onClick={handleSignOut} className="text-sm text-red-600 hover:underline">
            Switch User
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
                list="vendor-list"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <datalist id="vendor-list">
                {VENDORS.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Truck # <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={truckNumber}
                  onChange={e => setTruckNumber(e.target.value)}
                  placeholder="e.g. T-101"
                  list="truck-list"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <datalist id="truck-list">
                  {truckNumbers.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO # <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-1234"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Arrivals</h2>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor…"
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
          </div>
          {filteredArrivals.length === 0 ? (
            <p className="text-gray-400 text-sm">{search ? 'No matching arrivals.' : 'No arrivals logged yet.'}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredArrivals.map((a, i) => (
                <li key={a.id ?? i} className="py-4">
                  {editingArrival === a.id ? (
                    <form onSubmit={handleSaveArrival} className="bg-blue-50 rounded-md p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Name</label>
                          <input type="text" value={editVendor} onChange={e => setEditVendor(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Truck #</label>
                          <input type="text" value={editTruckNum} onChange={e => setEditTruckNum(e.target.value)}
                            list="truck-list"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">PO # <span className="text-gray-400 font-normal">(optional)</span></label>
                          <input type="text" value={editPoNum} onChange={e => setEditPoNum(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Door</label>
                          <select value={editDoor} onChange={e => setEditDoor(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- None --</option>
                            {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>Door {d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Arrival Time</label>
                          <input type="datetime-local" value={editTime} onChange={e => setEditTime(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={savingEdit}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setEditingArrival(null)}
                          className="text-gray-500 px-3 py-1 rounded text-sm hover:bg-gray-100">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div>
                          <p className="font-medium text-gray-800">{a.vendor_name}</p>
                          <p className="text-sm text-gray-500">
                            Truck: {a.truck_number || a.truck_po}
                            {a.po_number ? ` · PO: ${a.po_number}` : ''}
                            {a.door ? ` · Door ${a.door}` : ''}
                            {a.cleared_at ? ' · Cleared' : ''}
                          </p>
                        </div>
                        <div className="flex items-start gap-2 shrink-0">
                          <p className="text-sm text-gray-400 whitespace-nowrap">
                            {new Date(a.arrived_at).toLocaleString()}
                          </p>
                          <button onClick={() => openEditArrival(a)}
                            className="text-xs text-blue-500 hover:underline">Edit</button>
                          <button onClick={() => deleteArrival(a.id)}
                            className="text-xs text-red-400 hover:underline">Delete</button>
                        </div>
                      </div>

                      {tasks[a.id] && tasks[a.id].length > 0 && (
                        <ul className="ml-3 mb-2 space-y-1 border-l-2 border-gray-100 pl-3">
                          {tasks[a.id].map(t => (
                            <li key={t.id} className="text-xs text-gray-500">
                              {editingTaskEnd === t.id ? (
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-700">{t.task_name}</span>
                                  <span>· End:</span>
                                  <input
                                    type="datetime-local"
                                    value={taskEndValue}
                                    onChange={e => setTaskEndValue(e.target.value)}
                                    className="border border-gray-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button onClick={() => saveTaskEnd(t.id)} className="text-blue-600 hover:underline">Save</button>
                                  <button onClick={() => setEditingTaskEnd(null)} className="text-gray-400 hover:underline">Cancel</button>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 flex-wrap">
                                  <span className="font-medium text-gray-700">{t.task_name}</span>
                                  <span>· {t.performer_email.split('@')[0]}</span>
                                  <span>· {new Date(t.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {t.ended_at
                                    ? <span>– {new Date(t.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    : (
                                      <button
                                        onClick={() => { setEditingTaskEnd(t.id); setTaskEndValue(nowLocal()) }}
                                        className="text-blue-500 hover:underline"
                                      >Set end</button>
                                    )
                                  }
                                  <button onClick={() => deleteTask(t.id)} className="text-red-400 hover:underline ml-1">×</button>
                                </span>
                              )}
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
                    </>
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
