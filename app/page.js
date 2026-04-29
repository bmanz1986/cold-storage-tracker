'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState(null)
  const [arrivals, setArrivals] = useState([])
  const [vendorName, setVendorName] = useState('')
  const [truckPo, setTruckPo] = useState('')
  const [arrivedAt, setArrivedAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const router = useRouter()

  const fetchArrivals = useCallback(async () => {
    const { data } = await supabase
      .from('arrivals')
      .select('*')
      .order('arrived_at', { ascending: false })
      .limit(20)
    if (data) setArrivals(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        fetchArrivals()
      }
    })
  }, [router, fetchArrivals])

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
    })

    if (error) {
      setMessage({ type: 'error', text: 'Error saving arrival: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Arrival logged successfully!' })
      setVendorName('')
      setTruckPo('')
      setArrivedAt('')
      fetchArrivals()
    }
    setSubmitting(false)
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
          <button
            onClick={handleSignOut}
            className="text-sm text-red-600 hover:underline"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">

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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arrival Time{' '}
                <span className="text-gray-400 font-normal">(leave blank to use current time)</span>
              </label>
              <input
                type="datetime-local"
                value={arrivedAt}
                onChange={e => setArrivedAt(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                      <p className="text-sm text-gray-500">PO / Truck: {a.truck_po}</p>
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
