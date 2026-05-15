'use client'
import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// --- helpers ---

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function tempCellValue(insp) {
  // Pick whichever actual temp applies; fall back to set point label
  if (insp.temperature_required === 'Frozen') return insp.frozen_actual ?? '—'
  if (insp.temperature_required === 'Refrigerated') return insp.refrigerated_actual ?? '—'
  if (insp.temperature_required === 'Ambient') return 'amb'
  return insp.frozen_actual ?? insp.refrigerated_actual ?? '—'
}

function ncStatus(insp) {
  if (insp.truck_inspection_ok === false || insp.pallet_inspection_ok === false) return 'NC'
  return 'OK'
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

// --- main page ---

export default function InspectionsPage() {
  const [user, setUser] = useState(null)
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [vendorQuery, setVendorQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [direction, setDirection] = useState('')   // '', 'Inbound', 'Outbound', 'Both'
  const [tempReq, setTempReq] = useState('')       // '', 'Frozen', 'Refrigerated', 'Ambient'
  const [ncOnly, setNcOnly] = useState(false)
  const [expanded, setExpanded] = useState(null)   // row id

  const router = useRouter()

  const fetchInspections = useCallback(async () => {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .order('inspected_at', { ascending: false })
      .limit(1000)
    if (error) {
      console.error('Failed to fetch inspections:', error.message)
      setInspections([])
    } else {
      setInspections(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      fetchInspections()
    })
  }, [router, fetchInspections])

  // Live updates
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('inspections-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections' }, fetchInspections)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchInspections])

  // Distinct vendor list for the search dropdown
  const vendorOptions = useMemo(() => {
    const set = new Set(inspections.map(i => i.vendor_name).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [inspections])

  // Apply filters
  const filtered = useMemo(() => {
    return inspections.filter(i => {
      if (vendorQuery && !i.vendor_name?.toLowerCase().includes(vendorQuery.toLowerCase())) return false
      if (fromDate && new Date(i.inspected_at) < new Date(fromDate + 'T00:00:00')) return false
      if (toDate && new Date(i.inspected_at) > new Date(toDate + 'T23:59:59')) return false
      if (direction && i.direction !== direction) return false
      if (tempReq && i.temperature_required !== tempReq) return false
      if (ncOnly && i.truck_inspection_ok !== false && i.pallet_inspection_ok !== false) return false
      return true
    })
  }, [inspections, vendorQuery, fromDate, toDate, direction, tempReq, ncOnly])

  // Quick stats
  const stats = useMemo(() => {
    const total = filtered.length
    const ncCount = filtered.filter(i => i.truck_inspection_ok === false || i.pallet_inspection_ok === false).length
    const tempNotOk = filtered.filter(i => i.temperature_acceptable === false).length
    return { total, ncCount, tempNotOk }
  }, [filtered])

  function clearFilters() {
    setVendorQuery('')
    setFromDate('')
    setToDate('')
    setDirection('')
    setTempReq('')
    setNcOnly(false)
  }

  function handleExport() {
    const headers = [
      'Inspected At', 'Direction', 'Team', 'Inspector', 'Carrier', 'Vendor', 'Vendor Type',
      'PO / Order', 'BOL Included', 'Locked/Sealed', 'Seal #', 'Seal Matches',
      'Temp Required', 'Set Point', 'Frozen Actual', 'Refrigerated Actual', 'Temp OK',
      'Truck OK', 'Truck NC Notes', 'Pallet OK', 'Pallet NC Notes', 'Pallet Type',
      'BOL Link', 'BOL Verified Date', 'BOL Verified Initials', 'BOL Matches Product', 'BOL Match Explanation',
    ]
    const rows = filtered.map(i => [
      fmtDateTime(i.inspected_at), i.direction, i.team, i.inspector_name, i.carrier_name,
      i.vendor_name, i.vendor_type, i.order_or_po, i.bol_included, i.truck_locked_or_sealed,
      i.seal_number, i.seal_matches_paperwork, i.temperature_required, i.set_point,
      i.frozen_actual, i.refrigerated_actual, i.temperature_acceptable,
      i.truck_inspection_ok, i.truck_nc_notes, i.pallet_inspection_ok, i.pallet_nc_notes,
      i.pallet_type, i.bol_verify_link, i.bol_verified_date, i.bol_verified_initials,
      i.bol_matches_product, i.bol_match_explanation,
    ])
    const tag = (fromDate || toDate) ? `${fromDate || 'start'}-to-${toDate || 'today'}` : 'all'
    downloadCsv(`inspections-${tag}.csv`, headers, rows)
  }

  if (!user) return null
  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Loading inspections…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Inspection Log</h1>
        <div className="flex items-center gap-4">
          <Link href="/reports" className="text-sm text-gray-600 hover:underline">Reports</Link>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-4">

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
              <input
                type="text"
                list="vendor-options"
                value={vendorQuery}
                onChange={e => setVendorQuery(e.target.value)}
                placeholder="Search any vendor…"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="vendor-options">
                {vendorOptions.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Direction</label>
              <select
                value={direction}
                onChange={e => setDirection(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option>Inbound</option>
                <option>Outbound</option>
                <option>Both</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Temp Req</label>
              <select
                value={tempReq}
                onChange={e => setTempReq(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option>Frozen</option>
                <option>Refrigerated</option>
                <option>Ambient</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-sm text-gray-700 pb-1.5">
              <input
                type="checkbox"
                checked={ncOnly}
                onChange={e => setNcOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              Non-conformances only
            </label>

            <div className="ml-auto flex gap-2 pb-0.5">
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5">
                Clear
              </button>
              <button onClick={handleExport} className="text-sm text-blue-600 hover:underline px-2 py-1.5">
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-xs text-gray-500">Inspections shown</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <p className={`text-2xl font-bold ${stats.ncCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.ncCount}</p>
            <p className="text-xs text-gray-500">Non-conformances</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <p className={`text-2xl font-bold ${stats.tempNotOk > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.tempNotOk}</p>
            <p className="text-xs text-gray-500">Temp not acceptable</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm p-6 text-center">
              {inspections.length === 0
                ? 'No inspections yet. Once the inspections table is created and entries are logged, they\'ll show here.'
                : 'No inspections match your filters.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Direction</th>
                    <th className="px-3 py-2 font-medium">Vendor</th>
                    <th className="px-3 py-2 font-medium">PO / BOL</th>
                    <th className="px-3 py-2 font-medium text-right">Set Pt</th>
                    <th className="px-3 py-2 font-medium text-right">Actual</th>
                    <th className="px-3 py-2 font-medium text-center">Temp OK</th>
                    <th className="px-3 py-2 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(i => {
                    const status = ncStatus(i)
                    const isOpen = expanded === i.id
                    return (
                      <Fragment key={i.id}>
                        <tr
                          onClick={() => setExpanded(isOpen ? null : i.id)}
                          className="cursor-pointer hover:bg-blue-50/50"
                        >
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(i.inspected_at)}</td>
                          <td className="px-3 py-2 text-gray-700">{i.direction}</td>
                          <td className="px-3 py-2 text-gray-800 font-medium">{i.vendor_name}</td>
                          <td className="px-3 py-2 text-gray-600">{i.order_or_po || '—'}</td>
                          <td className="px-3 py-2 text-gray-600 text-right">{i.set_point ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 text-right">{tempCellValue(i)}</td>
                          <td className="px-3 py-2 text-center">
                            {i.temperature_acceptable === false
                              ? <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">No</span>
                              : i.temperature_acceptable === true
                                ? <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Yes</span>
                                : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {status === 'NC'
                              ? <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">NC</span>
                              : <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">OK</span>}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-6 py-4">
                              <DetailGrid insp={i} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center pt-2">
          Click any row to see the full inspection details.
        </p>

      </main>
    </div>
  )
}

// --- detail panel for the expanded row ---

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value ?? '—'}</p>
    </div>
  )
}

function bool(v) {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return '—'
}

function DetailGrid({ insp }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Inspected At" value={fmtDateTime(insp.inspected_at)} />
        <Field label="Team" value={insp.team} />
        <Field label="Inspector" value={insp.inspector_name} />
        <Field label="Carrier" value={insp.carrier_name} />
        <Field label="Vendor Type" value={insp.vendor_type} />
        <Field label="Direction" value={insp.direction} />
        <Field label="Order / PO #" value={insp.order_or_po} />
        <Field label="BOL Included" value={bool(insp.bol_included)} />
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sealing</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Locked / Sealed" value={insp.truck_locked_or_sealed} />
          <Field label="Seal #" value={insp.seal_number} />
          <Field label="Seal Matches Paperwork" value={bool(insp.seal_matches_paperwork)} />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Temperature</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Required" value={insp.temperature_required} />
          <Field label="Set Point" value={insp.set_point} />
          <Field label="Frozen Actual" value={insp.frozen_actual} />
          <Field label="Refrigerated Actual" value={insp.refrigerated_actual} />
          <Field label="Acceptable" value={bool(insp.temperature_acceptable)} />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Inspection</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Truck OK" value={bool(insp.truck_inspection_ok)} />
          <Field label="Truck NC Notes" value={insp.truck_nc_notes} />
          <Field label="Pallet OK" value={bool(insp.pallet_inspection_ok)} />
          <Field label="Pallet NC Notes" value={insp.pallet_nc_notes} />
          <Field label="Pallet Type" value={insp.pallet_type} />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">BOL Verification</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field
            label="BOL Link"
            value={insp.bol_verify_link
              ? <a href={insp.bol_verify_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
              : '—'}
          />
          <Field label="Verified Date" value={fmtDate(insp.bol_verified_date)} />
          <Field label="Verified Initials" value={insp.bol_verified_initials} />
          <Field label="Matches Product" value={bool(insp.bol_matches_product)} />
          <Field label="Match Explanation" value={insp.bol_match_explanation} />
        </div>
      </div>
    </div>
  )
}
