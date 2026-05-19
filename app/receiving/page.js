'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ReceivingPage() {
  const [user, setUser] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [searchVendor, setSearchVendor] = useState('')
  const [searchInvoice, setSearchInvoice] = useState('')
  const [searchLot, setSearchLot] = useState('')
  const [searchDate, setSearchDate] = useState('')

  const router = useRouter()

  const fetchLogs = useCallback(async (filters = {}) => {
    setLoading(true)

    // If searching by lot#, find the parent log first
    if (filters.lot) {
      const lotNum = parseInt(filters.lot)
      if (!isNaN(lotNum)) {
        const { data: items } = await supabase
          .from('receiving_items')
          .select('receiving_log_id')
          .eq('lot_number', lotNum)
        if (items && items.length > 0) {
          const ids = [...new Set(items.map(i => i.receiving_log_id))]
          const { data } = await supabase
            .from('receiving_logs')
            .select('*, receiving_items(*)')
            .in('id', ids)
            .order('received_date', { ascending: false })
          setLogs(data || [])
          setLoading(false)
          return
        } else {
          setLogs([])
          setLoading(false)
          return
        }
      }
    }

    let query = supabase
      .from('receiving_logs')
      .select('*, receiving_items(*)')
      .order('received_date', { ascending: false })
      .limit(100)

    if (filters.vendor) query = query.ilike('vendor_name', `%${filters.vendor}%`)
    if (filters.invoice) query = query.ilike('invoice_number', `%${filters.invoice}%`)
    if (filters.date) query = query.eq('received_date', filters.date)

    const { data } = await query
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        fetchLogs()
      }
    })
  }, [router, fetchLogs])

  function handleSearch(e) {
    e.preventDefault()
    fetchLogs({
      vendor: searchVendor.trim(),
      invoice: searchInvoice.trim(),
      lot: searchLot.trim(),
      date: searchDate,
    })
  }

  function clearSearch() {
    setSearchVendor('')
    setSearchInvoice('')
    setSearchLot('')
    setSearchDate('')
    fetchLogs()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAdmin = user?.user_metadata?.role === 'admin'

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-800">Receiving Log</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
          {isAdmin && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
          <Link href="/inspections" className="text-sm text-blue-600 hover:underline">Inspections</Link>
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">Reports</Link>
          <button onClick={handleSignOut} className="text-sm text-red-600 hover:underline">Switch User</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Search Receiving Logs</h2>
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                <input
                  type="text"
                  value={searchVendor}
                  onChange={e => setSearchVendor(e.target.value)}
                  placeholder="Any vendor…"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Invoice #</label>
                <input
                  type="text"
                  value={searchInvoice}
                  onChange={e => setSearchInvoice(e.target.value)}
                  placeholder="Invoice #…"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lot #</label>
                <input
                  type="text"
                  value={searchLot}
                  onChange={e => setSearchLot(e.target.value)}
                  placeholder="e.g. 06480"
                  inputMode="numeric"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={searchDate}
                  onChange={e => setSearchDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit"
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 transition-colors">
                Search
              </button>
              <button type="button" onClick={clearSearch}
                className="text-gray-500 px-4 py-1.5 rounded text-sm hover:bg-gray-100">
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {loading ? 'Loading…' : `${logs.length} log${logs.length === 1 ? '' : 's'}`}
            </h2>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-gray-400 text-sm">No receiving logs found.</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => {
                const items = log.receiving_items || []
                const lotNums = items.map(i => i.lot_number).sort((a, b) => a - b)
                const lotRange = lotNums.length === 0 ? '—'
                  : lotNums.length === 1 ? `#${String(lotNums[0]).padStart(5, '0')}`
                  : `#${String(lotNums[0]).padStart(5, '0')} – #${String(lotNums[lotNums.length - 1]).padStart(5, '0')}`
                const highlightLot = searchLot && !isNaN(parseInt(searchLot))
                  ? parseInt(searchLot) : null

                return (
                  <Link key={log.id} href={`/receiving/${log.id}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{log.vendor_name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            log.status === 'complete'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {log.status === 'complete' ? 'Complete' : 'Receiving'}
                          </span>
                          {log.invoice_number && (
                            <span className="text-xs text-gray-500">Invoice: {log.invoice_number}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {log.received_date}
                          {log.truck_number ? ` · Truck ${log.truck_number}` : ''}
                          {log.po_carrier ? ` · PO/Carrier: ${log.po_carrier}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Lots: {lotRange} · {items.length} item{items.length === 1 ? '' : 's'}
                        </div>
                        {highlightLot && items.some(i => i.lot_number === highlightLot) && (
                          <div className="mt-1">
                            {items.filter(i => i.lot_number === highlightLot).map(i => (
                              <span key={i.id} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">
                                Lot #{String(i.lot_number).padStart(5, '0')} — {i.description || 'No description'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-blue-500 text-sm shrink-0">View →</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
