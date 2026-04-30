'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState(null)
  const [arrivals, setArrivals] = useState([])
  const [doorStatus, setDoorStatus] = useState({})
  const [vendorName, setVendorName] = useState('')
  const [truckPo, setTruckPo] = useState('')
  const [arrivedAt, setArrivedAt] = useState('')
  const [door, setDoor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
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
      }
    })
  }, [router, fetchArrivals, fetchDoorStatus])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

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
      setMessage({ type: 'error', text: 'Error saving arrival: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Arrival logged successfully!' })
      setVendorName('')
      setTruckPo('')
      setArrivedAt('')
      setDoor('')
      fetchArrivals()
      fetchDoorStatus()
    }
    setSubmitting(false)
  }

  async function clearDoor(arrivalId, doorNum) {
    setClearing(doorNum)
    const { error } = await supabase
      .from('arrivals')
      .update({ cleared_at: new Date().toISOString() })
      .eq('id', arrivalId)
    if (!error) {
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
                    occupied
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-green-50 border border-green-200'
                  }`}
                >
                  <p className="font-bold text-gray-700 text-sm">Door {doorNum}</p>
                  {occupied ? (
                    <>
                      <p className="text-xs text-gray-600 mt-1 truncate">{occupied.vendor_name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(occupied.arrived_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
            {message && (
              <p className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {message.text}
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

        {/* Recent Arrivals */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Arrivals</h2>
          {arrivals.length === 0 ? (
            <p className="text-gray-400 text-sm">No arrivals logged yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {arrivals.map((a, i) => (
                <li key={a.id ?? i} className="py-3">
                  <div className="flex justify-between items-start gap-4">
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
                </li>
              ))}
            </ul>
          )}
        </div>

      </main>
    </div>
  )
}
