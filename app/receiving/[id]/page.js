'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function ReceivingDetailPage() {
  const [user, setUser] = useState(null)
  const [log, setLog] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Log-level edit state
  const [editingHeader, setEditingHeader] = useState(false)
  const [editVendor, setEditVendor] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTruck, setEditTruck] = useState('')
  const [editDot, setEditDot] = useState('')
  const [editPoCarrier, setEditPoCarrier] = useState('')
  const [editInvoice, setEditInvoice] = useState('')
  const [editTransportClean, setEditTransportClean] = useState('')
  const [editTransportVent, setEditTransportVent] = useState('')
  const [editTransportNoDamage, setEditTransportNoDamage] = useState('')
  const [editProductOk, setEditProductOk] = useState('')
  const [editSafetyOk, setEditSafetyOk] = useState('')
  const [editComments, setEditComments] = useState('')
  const [editReceivedBy, setEditReceivedBy] = useState('')
  const [editWrittenBy, setEditWrittenBy] = useState('')
  const [editStatus, setEditStatus] = useState('')

  // New item form
  const [addingItem, setAddingItem] = useState(false)
  const [newUpc, setNewUpc] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPallets, setNewPallets] = useState('')
  const [newCases, setNewCases] = useState('')
  const [newCodeDate, setNewCodeDate] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [savingItem, setSavingItem] = useState(false)

  // Invoice-only edit (office staff shortcut)
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [invoiceValue, setInvoiceValue] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  // Inline item editing
  const [editingItem, setEditingItem] = useState(null)
  const [editItemData, setEditItemData] = useState({})
  const [teamMembers, setTeamMembers] = useState([])

  const router = useRouter()
  const params = useParams()
  const id = params.id

  const fetchLog = useCallback(async () => {
    const { data: logData } = await supabase
      .from('receiving_logs')
      .select('*')
      .eq('id', id)
      .single()
    const { data: itemData } = await supabase
      .from('receiving_items')
      .select('*')
      .eq('receiving_log_id', id)
      .order('lot_number', { ascending: true })
    setLog(logData || null)
    setItems(itemData || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        fetchLog()
        supabase.from('team_members').select('display_name').eq('active', true).eq('show_in_ops', true).order('display_name')
          .then(({ data }) => { if (data) setTeamMembers(data.map(r => r.display_name)) })
      }
    })
  }, [router, fetchLog])

  function openHeaderEdit() {
    setEditVendor(log.vendor_name || '')
    setEditDate(log.received_date || '')
    setEditTruck(log.truck_number || '')
    setEditDot(log.dot_permit || '')
    setEditPoCarrier(log.po_carrier || '')
    setEditInvoice(log.invoice_number || '')
    setEditTransportClean(log.transport_clean === true ? 'true' : log.transport_clean === false ? 'false' : '')
    setEditTransportVent(log.transport_ventilation === true ? 'true' : log.transport_ventilation === false ? 'false' : '')
    setEditTransportNoDamage(log.transport_no_damage === true ? 'true' : log.transport_no_damage === false ? 'false' : '')
    setEditProductOk(log.product_condition_ok === true ? 'true' : log.product_condition_ok === false ? 'false' : '')
    setEditSafetyOk(log.safety_guidelines_ok === true ? 'true' : log.safety_guidelines_ok === false ? 'false' : '')
    setEditComments(log.comments || '')
    setEditReceivedBy(log.received_by || '')
    setEditWrittenBy(log.written_up_by || '')
    setEditStatus(log.status || 'receiving')
    setEditingHeader(true)
  }

  async function saveHeader(e) {
    e.preventDefault()
    setSaving(true)
    const toBool = v => v === 'true' ? true : v === 'false' ? false : null
    const { error } = await supabase.from('receiving_logs').update({
      vendor_name: editVendor,
      received_date: editDate,
      truck_number: editTruck || null,
      dot_permit: editDot || null,
      po_carrier: editPoCarrier || null,
      invoice_number: editInvoice || null,
      transport_clean: toBool(editTransportClean),
      transport_ventilation: toBool(editTransportVent),
      transport_no_damage: toBool(editTransportNoDamage),
      product_condition_ok: toBool(editProductOk),
      safety_guidelines_ok: toBool(editSafetyOk),
      comments: editComments || null,
      received_by: editReceivedBy || null,
      written_up_by: editWrittenBy || null,
      status: editStatus,
    }).eq('id', id)
    if (!error) {
      setEditingHeader(false)
      fetchLog()
    } else {
      alert('Could not save: ' + error.message)
    }
    setSaving(false)
  }

  async function saveInvoiceOnly(e) {
    e.preventDefault()
    setSavingInvoice(true)
    const { error } = await supabase.from('receiving_logs').update({
      invoice_number: invoiceValue || null,
    }).eq('id', id)
    if (!error) {
      setEditingInvoice(false)
      fetchLog()
    } else {
      alert('Could not save: ' + error.message)
    }
    setSavingInvoice(false)
  }

  async function addItem(e) {
    e.preventDefault()
    setSavingItem(true)
    const { error } = await supabase.from('receiving_items').insert({
      receiving_log_id: id,
      upc: newUpc || null,
      description: newDesc || null,
      pallets: newPallets ? parseInt(newPallets) : null,
      cases: newCases ? parseInt(newCases) : null,
      code_date: newCodeDate || null,
      weight_per_pallet: newWeight || null,
      location: newLocation || null,
    })
    if (!error) {
      setAddingItem(false)
      setNewUpc(''); setNewDesc(''); setNewPallets(''); setNewCases('')
      setNewCodeDate(''); setNewWeight(''); setNewLocation('')
      fetchLog()
    } else {
      alert('Could not add item: ' + error.message)
    }
    setSavingItem(false)
  }

  function openItemEdit(item) {
    setEditingItem(item.id)
    setEditItemData({
      upc: item.upc || '',
      description: item.description || '',
      pallets: item.pallets != null ? String(item.pallets) : '',
      cases: item.cases != null ? String(item.cases) : '',
      code_date: item.code_date || '',
      weight_per_pallet: item.weight_per_pallet || '',
      location: item.location || '',
    })
  }

  async function saveItem(itemId) {
    const d = editItemData
    const { error } = await supabase.from('receiving_items').update({
      upc: d.upc || null,
      description: d.description || null,
      pallets: d.pallets ? parseInt(d.pallets) : null,
      cases: d.cases ? parseInt(d.cases) : null,
      code_date: d.code_date || null,
      weight_per_pallet: d.weight_per_pallet || null,
      location: d.location || null,
    }).eq('id', itemId)
    if (!error) {
      setEditingItem(null)
      fetchLog()
    } else {
      alert('Could not save: ' + error.message)
    }
  }

  async function deleteItem(itemId) {
    if (!window.confirm('Delete this product line?')) return
    await supabase.from('receiving_items').delete().eq('id', itemId)
    fetchLog()
  }

  async function markComplete() {
    if (!window.confirm('Mark this receiving log as complete?')) return
    await supabase.from('receiving_logs').update({ status: 'complete' }).eq('id', id)
    fetchLog()
  }

  async function deleteLog() {
    if (!window.confirm('Delete this entire receiving log and all its items?')) return
    await supabase.from('receiving_logs').delete().eq('id', id)
    router.push('/receiving')
  }

  const isAdmin = user?.user_metadata?.role === 'admin'

  if (!user) return null
  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-400">Loading…</p>
    </div>
  )
  if (!log) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Receiving log not found. <Link href="/receiving" className="text-blue-600 underline">Back to list</Link></p>
    </div>
  )

  const boolDisplay = v => v === true ? 'Yes' : v === false ? 'No' : '—'

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/receiving" className="text-gray-400 hover:text-gray-600 text-sm">← Receiving Log</Link>
          <h1 className="text-xl font-bold text-gray-800">Receiving Detail</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => window.print()}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded font-medium transition-colors">
            Print
          </button>
          {log.status !== 'complete' && (
            <button onClick={markComplete}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-medium transition-colors">
              Mark Complete
            </button>
          )}
          {isAdmin && (
            <button onClick={deleteLog}
              className="text-sm text-red-500 hover:underline">
              Delete
            </button>
          )}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="text-sm text-red-600 hover:underline">Switch User</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6 print:p-2 print:space-y-4">

        {/* Print header */}
        <div className="hidden print:block text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold">Receiving Log — {log.vendor_name}</h1>
          <p className="text-gray-600">{log.received_date}</p>
        </div>

        {/* Shipment Info */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {editingHeader ? (
            <form onSubmit={saveHeader} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vendor <span className="text-red-500">*</span></label>
                  <input type="text" value={editVendor} onChange={e => setEditVendor(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Received Date <span className="text-red-500">*</span></label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Truck #</label>
                  <input type="text" value={editTruck} onChange={e => setEditTruck(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DOT Permit</label>
                  <input type="text" value={editDot} onChange={e => setEditDot(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">PO / Carrier</label>
                  <input type="text" value={editPoCarrier} onChange={e => setEditPoCarrier(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Invoice # <span className="text-gray-400">(office)</span></label>
                  <input type="text" value={editInvoice} onChange={e => setEditInvoice(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transport Conditions</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['Transport Clean', editTransportClean, setEditTransportClean],
                  ['Ventilation OK', editTransportVent, setEditTransportVent],
                  ['No Damage', editTransportNoDamage, setEditTransportNoDamage],
                  ['Product Condition OK', editProductOk, setEditProductOk],
                  ['Safety Guidelines OK', editSafetyOk, setEditSafetyOk],
                ].map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <select value={val} onChange={e => setter(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">—</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Received By</label>
                  <select value={editReceivedBy} onChange={e => setEditReceivedBy(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Select --</option>
                    {teamMembers.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Written Up By</label>
                  <select value={editWrittenBy} onChange={e => setEditWrittenBy(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Select --</option>
                    {teamMembers.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Comments</label>
                <textarea value={editComments} onChange={e => setEditComments(e.target.value)} rows={2}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="receiving">Receiving</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingHeader(false)}
                  className="text-gray-500 px-4 py-1.5 rounded text-sm hover:bg-gray-100">Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-800">{log.vendor_name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      log.status === 'complete'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {log.status === 'complete' ? 'Complete' : 'Receiving'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5">{log.received_date}</p>
                </div>
                <button onClick={openHeaderEdit}
                  className="text-sm text-blue-600 hover:underline print:hidden">Edit</button>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">Truck #</span>
                  <span className="text-gray-800 font-medium">{log.truck_number || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">DOT Permit</span>
                  <span className="text-gray-800 font-medium">{log.dot_permit || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">PO / Carrier</span>
                  <span className="text-gray-800 font-medium">{log.po_carrier || '—'}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-gray-500 w-28 shrink-0">Invoice #</span>
                  {editingInvoice ? (
                    <form onSubmit={saveInvoiceOnly} className="flex gap-1 items-center">
                      <input type="text" value={invoiceValue} onChange={e => setInvoiceValue(e.target.value)}
                        placeholder="Invoice #"
                        className="border border-gray-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
                      <button type="submit" disabled={savingInvoice}
                        className="text-blue-600 text-sm hover:underline">{savingInvoice ? '…' : 'Save'}</button>
                      <button type="button" onClick={() => setEditingInvoice(false)}
                        className="text-gray-400 text-sm hover:underline">Cancel</button>
                    </form>
                  ) : (
                    <span className="text-gray-800 font-medium flex items-center gap-2">
                      {log.invoice_number || <span className="text-gray-400 italic">Not yet assigned</span>}
                      <button onClick={() => { setInvoiceValue(log.invoice_number || ''); setEditingInvoice(true) }}
                        className="text-blue-500 text-xs hover:underline print:hidden">
                        {log.invoice_number ? 'Edit' : 'Add'}
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">Received By</span>
                  <span className="text-gray-800 font-medium">{log.received_by || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28 shrink-0">Written Up By</span>
                  <span className="text-gray-800 font-medium">{log.written_up_by || '—'}</span>
                </div>
              </div>

              {(log.transport_clean !== null || log.transport_ventilation !== null || log.transport_no_damage !== null || log.product_condition_ok !== null || log.safety_guidelines_ok !== null) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Transport Conditions</p>
                  <div className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
                    {[
                      ['Transport Clean', log.transport_clean],
                      ['Ventilation OK', log.transport_ventilation],
                      ['No Damage', log.transport_no_damage],
                      ['Product Condition OK', log.product_condition_ok],
                      ['Safety Guidelines OK', log.safety_guidelines_ok],
                    ].map(([label, val]) => (
                      <div key={label} className="flex gap-2">
                        <span className="text-gray-500">{label}:</span>
                        <span className={`font-medium ${val === true ? 'text-green-600' : val === false ? 'text-red-500' : 'text-gray-400'}`}>
                          {boolDisplay(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {log.comments && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Comments</p>
                  <p className="text-sm text-gray-700">{log.comments}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Product Lines */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Product Lines ({items.length})</h2>
            {!addingItem && (
              <button onClick={() => setAddingItem(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded font-medium hover:bg-blue-700 transition-colors print:hidden">
                + Add Item
              </button>
            )}
          </div>

          {addingItem && (
            <form onSubmit={addItem} className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">New Product Line</p>
              <p className="text-xs text-blue-600">Lot number will be assigned automatically.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                    placeholder="e.g. Ground Beef 80/20"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">UPC</label>
                  <input type="text" value={newUpc} onChange={e => setNewUpc(e.target.value)}
                    inputMode="numeric"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code Date</label>
                  <input type="date" value={newCodeDate} onChange={e => setNewCodeDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pallets</label>
                  <input type="number" value={newPallets} onChange={e => setNewPallets(e.target.value)}
                    min="0" inputMode="numeric"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cases</label>
                  <input type="number" value={newCases} onChange={e => setNewCases(e.target.value)}
                    min="0" inputMode="numeric"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Weight / Pallet</label>
                  <input type="text" value={newWeight} onChange={e => setNewWeight(e.target.value)}
                    placeholder="e.g. 1,200 lbs"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)}
                    placeholder="e.g. Freezer A-3"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingItem}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingItem ? 'Saving…' : 'Save Item'}
                </button>
                <button type="button" onClick={() => setAddingItem(false)}
                  className="text-gray-500 px-4 py-1.5 rounded text-sm hover:bg-gray-100">Cancel</button>
              </div>
            </form>
          )}

          {items.length === 0 ? (
            <p className="text-gray-400 text-sm">No product lines yet. Add items above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left pb-2 pr-4">Lot #</th>
                    <th className="text-left pb-2 pr-4">Description</th>
                    <th className="text-left pb-2 pr-4">UPC</th>
                    <th className="text-left pb-2 pr-4">Pallets</th>
                    <th className="text-left pb-2 pr-4">Cases</th>
                    <th className="text-left pb-2 pr-4">Code Date</th>
                    <th className="text-left pb-2 pr-4">Wt/Pallet</th>
                    <th className="text-left pb-2 pr-4">Location</th>
                    <th className="pb-2 print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id} className={editingItem === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      {editingItem === item.id ? (
                        <>
                          <td className="py-2 pr-4">
                            <span className="font-mono font-bold text-blue-700">
                              #{String(item.lot_number).padStart(5, '0')}
                            </span>
                          </td>
                          {['description', 'upc', 'pallets', 'cases', 'code_date', 'weight_per_pallet', 'location'].map(field => (
                            <td key={field} className="py-2 pr-4">
                              <input
                                type={field === 'pallets' || field === 'cases' ? 'number' : field === 'code_date' ? 'date' : 'text'}
                                value={editItemData[field] || ''}
                                onChange={e => setEditItemData(prev => ({ ...prev, [field]: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          ))}
                          <td className="py-2 print:hidden">
                            <div className="flex gap-2">
                              <button onClick={() => saveItem(item.id)}
                                className="text-blue-600 text-xs hover:underline">Save</button>
                              <button onClick={() => setEditingItem(null)}
                                className="text-gray-400 text-xs hover:underline">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-4 font-mono font-bold text-blue-700">
                            #{String(item.lot_number).padStart(5, '0')}
                          </td>
                          <td className="py-2 pr-4 text-gray-800">{item.description || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.upc || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.pallets ?? '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.cases ?? '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.code_date || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.weight_per_pallet || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.location || '—'}</td>
                          <td className="py-2 print:hidden">
                            <div className="flex gap-2">
                              <button onClick={() => openItemEdit(item)}
                                className="text-blue-500 text-xs hover:underline">Edit</button>
                              <button onClick={() => deleteItem(item.id)}
                                className="text-red-400 text-xs hover:underline">×</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          body { background: white; }
          header { box-shadow: none; }
        }
      `}</style>
    </div>
  )
}
