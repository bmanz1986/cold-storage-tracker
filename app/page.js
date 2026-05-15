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
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}`
}

function toLocalInput(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${dy}T${h}:${mi}`
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [arrivals, setArrivals] = useState([])
  const [tasks, setTasks] = useState({})
  const [doorStatus, setDoorStatus] = useState({})
  const [search, setSearch] = useState('')

  const [vendorName, setVendorName] = useState('')
  const [isNewVendor, setIsNewVendor] = useState(false)
  const [truckNumber, setTruckNumber] = useState('')
  const [isNewTruck, setIsNewTruck] = useState(false)
  const [poNumber, setPoNumber] = useState('')
  const [arrivedAt, setArrivedAt] = useState('')
  const [door, setDoor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [arrivalMessage, setArrivalMessage] = useState(null)

  const [vendorList, setVendorList] = useState(VENDORS)
  const [truckNumbers, setTruckNumbers] = useState([])

  const [editingArrival, setEditingArrival] = useState(null)
  const [editVendor, setEditVendor] = useState('')
  const [isNewVendorEdit, setIsNewVendorEdit] = useState(false)
  const [editTruckNum, setEditTruckNum] = useState('')
  const [isNewTruckEdit, setIsNewTruckEdit] = useState(false)
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

  const [inspections, setInspections] = useState({})
  const [addingInspTo, setAddingInspTo] = useState(null)
  const [inspSubmitting, setInspSubmitting] = useState(false)
  const [inspMessage, setInspMessage] = useState(null)
  const [inspDirection, setInspDirection] = useState('')
  const [inspVendor, setInspVendor] = useState('')
  const [inspIsNewVendor, setInspIsNewVendor] = useState(false)
  const [inspVendorType, setInspVendorType] = useState('')
  const [inspInspectorName, setInspInspectorName] = useState('')
  const [inspTeam, setInspTeam] = useState('')
  const [inspCarrier, setInspCarrier] = useState('')
  const [inspOrderPo, setInspOrderPo] = useState('')
  const [inspAt, setInspAt] = useState('')
  const [inspBolIncluded, setInspBolIncluded] = useState('')
  const [inspLockedSealed, setInspLockedSealed] = useState('')
  const [inspSealNum, setInspSealNum] = useState('')
  const [inspSealMatches, setInspSealMatches] = useState('')
  const [inspTempRequired, setInspTempRequired] = useState('')
  const [inspSetPoint, setInspSetPoint] = useState('')
  const [inspFrozenActual, setInspFrozenActual] = useState('')
  const [inspRefrigActual, setInspRefrigActual] = useState('')
  const [inspTempOk, setInspTempOk] = useState('')
  const [inspTruckOk, setInspTruckOk] = useState('true')
  const [inspTruckNcNotes, setInspTruckNcNotes] = useState('')
  const [inspPalletOk, setInspPalletOk] = useState('true')
  const [inspPalletNcNotes, setInspPalletNcNotes] = useState('')
  const [inspPalletType, setInspPalletType] = useState('')

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

  const fetchInspections = useCallback(async () => {
    const { data } = await supabase
      .from('inspections')
      .select('*')
      .not('arrival_id', 'is', null)
      .order('inspected_at', { ascending: true })
    if (data) {
      const byArrival = {}
      data.forEach(insp => {
        if (!byArrival[insp.arrival_id]) byArrival[insp.arrival_id] = []
        byArrival[insp.arrival_id].push(insp)
      })
      setInspections(byArrival)
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
        fetchInspections()
        supabase.from('arrivals').select('truck_number').then(({ data }) => {
          if (data) setTruckNumbers([...new Set(data.map(r => r.truck_number).filter(Boolean))].sort())
        })
        Promise.all([
          supabase.from('arrivals').select('vendor_name'),
          supabase.from('inspections').select('vendor_name'),
        ]).then(([{ data: av }, { data: iv }]) => {
          const all = [...VENDORS]
          if (av) av.forEach(r => { if (r.vendor_name) all.push(r.vendor_name) })
          if (iv) iv.forEach(r => { if (r.vendor_name) all.push(r.vendor_name) })
          setVendorList([...new Set(all)].sort())
        })
      }
    })
  }, [router, fetchArrivals, fetchDoorStatus, fetchTasks, fetchInspections])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrivals' }, () => {
        fetchArrivals()
        fetchDoorStatus()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections' }, fetchInspections)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchArrivals, fetchDoorStatus, fetchTasks, fetchInspections])

  async function handleArrivalSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setArrivalMessage(null)
    const timestamp = arrivedAt ? new Date(arrivedAt).toISOString() : new Date().toISOString()
    const { error } = await supabase.from('arrivals').insert({
      id: crypto.randomUUID(),
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
      setIsNewVendor(false)
      setTruckNumber('')
      setIsNewTruck(false)
      setPoNumber('')
      setArrivedAt('')
      setDoor('')
      if (truckNumber) setTruckNumbers(prev => [...new Set([...prev, truckNumber])].sort())
      fetchArrivals()
      fetchDoorStatus()
    }
    setSubmitting(false)
  }

  function openEditArrival(a) {
    setEditingArrival(a.id)
    setEditVendor(a.vendor_name)
    setIsNewVendorEdit(!vendorList.includes(a.vendor_name))
    const t = a.truck_number || a.truck_po || ''
    setEditTruckNum(t)
    setIsNewTruckEdit(t && !truckNumbers.includes(t))
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

  function resetInspForm() {
    setInspDirection('')
    setInspVendor('')
    setInspIsNewVendor(false)
    setInspVendorType('')
    setInspInspectorName('')
    setInspTeam('')
    setInspCarrier('')
    setInspOrderPo('')
    setInspAt('')
    setInspBolIncluded('')
    setInspLockedSealed('')
    setInspSealNum('')
    setInspSealMatches('')
    setInspTempRequired('')
    setInspSetPoint('')
    setInspFrozenActual('')
    setInspRefrigActual('')
    setInspTempOk('')
    setInspTruckOk('true')
    setInspTruckNcNotes('')
    setInspPalletOk('true')
    setInspPalletNcNotes('')
    setInspPalletType('')
  }

  function openInspForm(arrival) {
    setAddingInspTo(arrival.id)
    setInspVendor(arrival.vendor_name)
    setInspIsNewVendor(!vendorList.includes(arrival.vendor_name))
    setInspAt(nowLocal())
    setInspDirection('')
    setInspVendorType('')
    setInspInspectorName('')
    setInspTeam('')
    setInspCarrier('')
    setInspOrderPo(arrival.po_number || '')
    setInspBolIncluded('')
    setInspLockedSealed('')
    setInspSealNum('')
    setInspSealMatches('')
    setInspTempRequired('')
    setInspSetPoint('')
    setInspFrozenActual('')
    setInspRefrigActual('')
    setInspTempOk('')
    setInspTruckOk('true')
    setInspTruckNcNotes('')
    setInspPalletOk('true')
    setInspPalletNcNotes('')
    setInspPalletType('')
    setInspMessage(null)
  }

  async function handleInspSubmit(e) {
    e.preventDefault()
    setInspSubmitting(true)
    setInspMessage(null)
    const toBool = v => v === 'true' ? true : v === 'false' ? false : null
    const { error } = await supabase.from('inspections').insert({
      arrival_id: addingInspTo,
      inspected_by: user.id,
      inspector_name: inspInspectorName || null,
      team: inspTeam || null,
      inspected_at: inspAt ? new Date(inspAt).toISOString() : new Date().toISOString(),
      direction: inspDirection,
      carrier_name: inspCarrier || null,
      vendor_name: inspVendor,
      vendor_type: inspVendorType || null,
      order_or_po: inspOrderPo || null,
      bol_included: toBool(inspBolIncluded),
      truck_locked_or_sealed: inspLockedSealed || null,
      seal_number: inspSealNum || null,
      seal_matches_paperwork: inspSealMatches === 'na' ? null : toBool(inspSealMatches),
      temperature_required: inspTempRequired || null,
      set_point: inspSetPoint ? parseFloat(inspSetPoint) : null,
      frozen_actual: inspFrozenActual ? parseFloat(inspFrozenActual) : null,
      refrigerated_actual: inspRefrigActual ? parseFloat(inspRefrigActual) : null,
      temperature_acceptable: toBool(inspTempOk),
      truck_inspection_ok: toBool(inspTruckOk),
      truck_nc_notes: inspTruckNcNotes || null,
      pallet_inspection_ok: toBool(inspPalletOk),
      pallet_nc_notes: inspPalletNcNotes || null,
      pallet_type: inspPalletType || null,
    })
    if (error) {
      setInspMessage({ type: 'error', text: 'Error: ' + error.message })
    } else {
      resetInspForm()
      setAddingInspTo(null)
      fetchInspections()
    }
    setInspSubmitting(false)
  }

  const isAdmin = user?.user_metadata?.role === 'admin'

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
          {isAdmin && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
          <Link href="/inspections" className="text-sm text-blue-600 hover:underline">Inspections</Link>
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
                Vendor <span className="text-red-500">*</span>
              </label>
              {isNewVendor ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    placeholder="Enter vendor name"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button type="button" onClick={() => { setIsNewVendor(false); setVendorName('') }}
                    className="text-gray-400 hover:text-gray-600 px-2">✕</button>
                </div>
              ) : (
                <select
                  value={vendorName}
                  onChange={e => { if (e.target.value === '__new__') { setIsNewVendor(true); setVendorName('') } else setVendorName(e.target.value) }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select vendor --</option>
                  {vendorList.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value="__new__">+ New vendor...</option>
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Truck # <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {isNewTruck ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={truckNumber}
                      onChange={e => setTruckNumber(e.target.value)}
                      placeholder="Enter truck #"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="button" onClick={() => { setIsNewTruck(false); setTruckNumber('') }}
                      className="text-gray-400 hover:text-gray-600 px-2">✕</button>
                  </div>
                ) : (
                  <select
                    value={truckNumber}
                    onChange={e => { if (e.target.value === '__new__') { setIsNewTruck(true); setTruckNumber('') } else setTruckNumber(e.target.value) }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select --</option>
                    {truckNumbers.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__new__">+ New truck #...</option>
                  </select>
                )}
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
                  onFocus={() => { if (!arrivedAt) setArrivedAt(nowLocal()) }}
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
                          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                          {isNewVendorEdit ? (
                            <div className="flex gap-1">
                              <input type="text" value={editVendor} onChange={e => setEditVendor(e.target.value)}
                                placeholder="Enter vendor name"
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                              <button type="button" onClick={() => { setIsNewVendorEdit(false); setEditVendor('') }}
                                className="text-gray-400 hover:text-gray-600 px-1">✕</button>
                            </div>
                          ) : (
                            <select value={editVendor}
                              onChange={e => { if (e.target.value === '__new__') { setIsNewVendorEdit(true); setEditVendor('') } else setEditVendor(e.target.value) }}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                              <option value="">-- Select --</option>
                              {vendorList.map(v => <option key={v} value={v}>{v}</option>)}
                              <option value="__new__">+ New vendor...</option>
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Truck #</label>
                          {isNewTruckEdit ? (
                            <div className="flex gap-1">
                              <input type="text" value={editTruckNum} onChange={e => setEditTruckNum(e.target.value)}
                                placeholder="Enter truck #"
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              <button type="button" onClick={() => { setIsNewTruckEdit(false); setEditTruckNum('') }}
                                className="text-gray-400 hover:text-gray-600 px-1">✕</button>
                            </div>
                          ) : (
                            <select value={editTruckNum}
                              onChange={e => { if (e.target.value === '__new__') { setIsNewTruckEdit(true); setEditTruckNum('') } else setEditTruckNum(e.target.value) }}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">-- Select --</option>
                              {truckNumbers.map(t => <option key={t} value={t}>{t}</option>)}
                              <option value="__new__">+ New truck #...</option>
                            </select>
                          )}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-800">{a.vendor_name}</p>
                            {inspections[a.id]?.length > 0
                              ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Inspected</span>
                              : <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Needs Inspection</span>
                            }
                          </div>
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
                          {isAdmin && <>
                            <button onClick={() => openEditArrival(a)}
                              className="text-xs text-blue-500 hover:underline">Edit</button>
                            <button onClick={() => deleteArrival(a.id)}
                              className="text-xs text-red-400 hover:underline">Delete</button>
                          </>}
                        </div>
                      </div>

                      {inspections[a.id]?.length > 0 && (
                        <ul className="ml-3 mb-2 space-y-1 border-l-2 border-green-200 pl-3">
                          {inspections[a.id].map(insp => {
                            const hasNC = insp.truck_inspection_ok === false || insp.pallet_inspection_ok === false
                            return (
                              <li key={insp.id} className="text-xs text-gray-500">
                                <span className="flex items-center gap-1 flex-wrap">
                                  <span className={`font-medium ${hasNC ? 'text-red-600' : 'text-green-700'}`}>Inspection</span>
                                  <span>· {insp.direction}</span>
                                  {insp.inspector_name && <span>· {insp.inspector_name}</span>}
                                  <span>· {new Date(insp.inspected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span>· Truck {insp.truck_inspection_ok === false ? <span className="text-red-500 font-medium">NC</span> : <span className="text-green-600">✓</span>}</span>
                                  <span>· Pallet {insp.pallet_inspection_ok === false ? <span className="text-red-500 font-medium">NC</span> : <span className="text-green-600">✓</span>}</span>
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )}

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
                              onFocus={() => { if (!taskEnded) setTaskEnded(nowLocal()) }}
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
                      ) : addingInspTo === a.id ? (
                        <form onSubmit={handleInspSubmit} className="mt-2 bg-green-50 border border-green-100 rounded-md p-3 space-y-3">
                          <p className="text-xs font-semibold text-green-800">Log Inspection</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Direction <span className="text-red-500">*</span></label>
                              <select value={inspDirection} onChange={e => setInspDirection(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                <option value="">-- Select --</option>
                                <option value="Inbound">Inbound</option>
                                <option value="Outbound">Outbound</option>
                                <option value="Both">Both</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Inspection Time</label>
                              <input type="datetime-local" value={inspAt} onChange={e => setInspAt(e.target.value)}
                                onFocus={() => { if (!inspAt) setInspAt(nowLocal()) }}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                              {inspIsNewVendor ? (
                                <div className="flex gap-1">
                                  <input type="text" value={inspVendor} onChange={e => setInspVendor(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                  <button type="button" onClick={() => { setInspIsNewVendor(false); setInspVendor('') }}
                                    className="text-gray-400 hover:text-gray-600 px-1">✕</button>
                                </div>
                              ) : (
                                <select value={inspVendor}
                                  onChange={e => { if (e.target.value === '__new__') { setInspIsNewVendor(true); setInspVendor('') } else setInspVendor(e.target.value) }}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                  <option value="">-- Select --</option>
                                  {vendorList.map(v => <option key={v} value={v}>{v}</option>)}
                                  <option value="__new__">+ New vendor...</option>
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Type</label>
                              <select value={inspVendorType} onChange={e => setInspVendorType(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Select --</option>
                                <option value="Cold Storage">Cold Storage</option>
                                <option value="Walden">Walden</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Inspector Name</label>
                              <input type="text" value={inspInspectorName} onChange={e => setInspInspectorName(e.target.value)}
                                placeholder="e.g. Kerwin"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Team</label>
                              <select value={inspTeam} onChange={e => setInspTeam(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Select --</option>
                                <option value="Cold Storage">Cold Storage</option>
                                <option value="Logistics">Logistics</option>
                                <option value="Walden Inventory">Walden Inventory</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Carrier</label>
                              <input type="text" value={inspCarrier} onChange={e => setInspCarrier(e.target.value)}
                                placeholder="e.g. FedEx"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Order / PO</label>
                              <input type="text" value={inspOrderPo} onChange={e => setInspOrderPo(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide border-t border-green-200 pt-2">BOL &amp; Sealing</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">BOL Included</label>
                              <select value={inspBolIncluded} onChange={e => setInspBolIncluded(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Select --</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Locked / Sealed</label>
                              <select value={inspLockedSealed} onChange={e => setInspLockedSealed(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Select --</option>
                                <option value="Locked - LTL or Walden Shipment">Locked - LTL or Walden</option>
                                <option value="Sealed - third party">Sealed - third party</option>
                                <option value="N/A - Open/Unsealed">N/A - Open/Unsealed</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Seal #</label>
                              <input type="text" value={inspSealNum} onChange={e => setInspSealNum(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Seal Matches Paperwork</label>
                              <select value={inspSealMatches} onChange={e => setInspSealMatches(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Select --</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                                <option value="na">N/A</option>
                              </select>
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide border-t border-green-200 pt-2">Temperature</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Temp Required</label>
                              <select value={inspTempRequired} onChange={e => setInspTempRequired(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">-- Select --</option>
                                <option value="Frozen">Frozen</option>
                                <option value="Refrigerated">Refrigerated</option>
                                <option value="Ambient">Ambient</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Set Point °F</label>
                              <input type="number" value={inspSetPoint} onChange={e => setInspSetPoint(e.target.value)}
                                placeholder="e.g. 0"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          {inspTempRequired !== 'Ambient' && (
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Frozen Actual °F</label>
                                <input type="number" value={inspFrozenActual} onChange={e => setInspFrozenActual(e.target.value)}
                                  placeholder="-10"
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Refrig. Actual °F</label>
                                <input type="number" value={inspRefrigActual} onChange={e => setInspRefrigActual(e.target.value)}
                                  placeholder="34"
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Temp Acceptable</label>
                                <select value={inspTempOk} onChange={e => setInspTempOk(e.target.value)}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                  <option value="">--</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>
                            </div>
                          )}
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide border-t border-green-200 pt-2">Inspection Results</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Truck Inspection</label>
                              <select value={inspTruckOk} onChange={e => setInspTruckOk(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="true">No NC Identified</option>
                                <option value="false">NC Found</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Pallet Inspection</label>
                              <select value={inspPalletOk} onChange={e => setInspPalletOk(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="true">No NC Identified</option>
                                <option value="false">NC Found</option>
                              </select>
                            </div>
                          </div>
                          {inspTruckOk === 'false' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Truck NC Notes</label>
                              <textarea value={inspTruckNcNotes} onChange={e => setInspTruckNcNotes(e.target.value)}
                                placeholder="Describe the non-conformance…" rows={2}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          )}
                          {inspPalletOk === 'false' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Pallet NC Notes</label>
                              <textarea value={inspPalletNcNotes} onChange={e => setInspPalletNcNotes(e.target.value)}
                                placeholder="Describe the non-conformance…" rows={2}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Pallet Type</label>
                            <input type="text" value={inspPalletType} onChange={e => setInspPalletType(e.target.value)}
                              placeholder="e.g. No Double Pallet Beams"
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          {inspMessage && (
                            <p className={`text-sm ${inspMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{inspMessage.text}</p>
                          )}
                          <div className="flex gap-2">
                            <button type="submit" disabled={inspSubmitting}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                              {inspSubmitting ? 'Saving…' : 'Save Inspection'}
                            </button>
                            <button type="button" onClick={() => { setAddingInspTo(null); setInspMessage(null) }}
                              className="text-gray-500 px-3 py-1 rounded text-sm hover:bg-gray-100">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <div className="mt-1 flex gap-4">
                          <button
                            onClick={() => openTaskForm(a.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            + Add Task
                          </button>
                          <button
                            onClick={() => openInspForm(a)}
                            className="text-xs text-green-600 hover:underline"
                          >
                            + Log Inspection
                          </button>
                        </div>
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
