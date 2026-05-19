'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const FILE_TYPES = [
  { value: 'bol', label: 'Bill of Lading' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'vendor_sheet', label: 'Vendor Sheet' },
  { value: 'other', label: 'Other' },
]

export default function ReceivingDetailPage() {
  const [user, setUser] = useState(null)
  const [log, setLog] = useState(null)
  const [items, setItems] = useState([])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  // Invoice-only edit
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [invoiceValue, setInvoiceValue] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  // Inline item editing
  const [editingItem, setEditingItem] = useState(null)
  const [editItemData, setEditItemData] = useState({})
  const [teamMembers, setTeamMembers] = useState([])

  // Attachments
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState('bol')
  const fileInputRef = useRef(null)

  const router = useRouter()
  const params = useParams()
  const id = params.id

  const fetchLog = useCallback(async () => {
    const { data: logData } = await supabase
      .from('receiving_logs').select('*').eq('id', id).single()
    const { data: itemData } = await supabase
      .from('receiving_items').select('*').eq('receiving_log_id', id)
      .order('lot_number', { ascending: true })
    setLog(logData || null)
    setItems(itemData || [])
    setLoading(false)
  }, [id])

  const fetchAttachments = useCallback(async () => {
    const { data } = await supabase
      .from('receiving_attachments').select('*').eq('receiving_log_id', id)
      .order('created_at', { ascending: true })
    setAttachments(data || [])
  }, [id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        fetchLog()
        fetchAttachments()
        supabase.from('team_members').select('display_name')
          .eq('active', true).eq('show_in_ops', true).order('display_name')
          .then(({ data }) => { if (data) setTeamMembers(data.map(r => r.display_name)) })
      }
    })
  }, [router, fetchLog, fetchAttachments])

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
    if (!error) { setEditingHeader(false); fetchLog() }
    else alert('Could not save: ' + error.message)
    setSaving(false)
  }

  async function saveInvoiceOnly(e) {
    e.preventDefault()
    setSavingInvoice(true)
    const { error } = await supabase.from('receiving_logs')
      .update({ invoice_number: invoiceValue || null }).eq('id', id)
    if (!error) { setEditingInvoice(false); fetchLog() }
    else alert('Could not save: ' + error.message)
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
    } else alert('Could not add item: ' + error.message)
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
    if (!error) { setEditingItem(null); fetchLog() }
    else alert('Could not save: ' + error.message)
  }

  async function deleteItem(itemId) {
    if (!window.confirm('Delete this product line?')) return
    await supabase.from('receiving_items').delete().eq('id', itemId)
    fetchLog()
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${id}/${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('receiving-docs').upload(filePath, file)
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }
    const { error: dbError } = await supabase.from('receiving_attachments').insert({
      receiving_log_id: id,
      file_name: file.name,
      file_path: filePath,
      file_type: uploadType,
      uploaded_by: user.id,
    })
    if (dbError) alert('Could not save attachment record: ' + dbError.message)
    else fetchAttachments()
    e.target.value = ''
    setUploading(false)
  }

  async function openAttachment(attachment) {
    const { data, error } = await supabase.storage
      .from('receiving-docs').createSignedUrl(attachment.file_path, 3600)
    if (error) { alert('Could not open file: ' + error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  async function deleteAttachment(attachment) {
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return
    await supabase.storage.from('receiving-docs').remove([attachment.file_path])
    await supabase.from('receiving_attachments').delete().eq('id', attachment.id)
    fetchAttachments()
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
  const boolDisplay = v => v === true ? 'Yes' : v === false ? 'No' : '—'
  const typeLabel = v => FILE_TYPES.find(t => t.value === v)?.label || v
  const typeBadgeColor = v => ({
    bol: 'bg-blue-100 text-blue-700',
    invoice: 'bg-green-100 text-green-700',
    vendor_sheet: 'bg-purple-100 text-purple-700',
    other: 'bg-gray-100 text-gray-600',
  }[v] || 'bg-gray-100 text-gray-600')

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Screen header ── */}
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
            <button onClick={deleteLog} className="text-sm text-red-500 hover:underline">Delete</button>
          )}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="text-sm text-red-600 hover:underline">Switch User</button>
        </div>
      </header>

      {/* ── Screen content ── */}
      <main className="max-w-4xl mx-auto p-6 space-y-6 print:hidden">

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
                      log.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {log.status === 'complete' ? 'Complete' : 'Receiving'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5">{log.received_date}</p>
                </div>
                <button onClick={openHeaderEdit} className="text-sm text-blue-600 hover:underline">Edit</button>
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
                      <button type="submit" disabled={savingInvoice} className="text-blue-600 text-sm hover:underline">{savingInvoice ? '…' : 'Save'}</button>
                      <button type="button" onClick={() => setEditingInvoice(false)} className="text-gray-400 text-sm hover:underline">Cancel</button>
                    </form>
                  ) : (
                    <span className="text-gray-800 font-medium flex items-center gap-2">
                      {log.invoice_number || <span className="text-gray-400 italic">Not yet assigned</span>}
                      <button onClick={() => { setInvoiceValue(log.invoice_number || ''); setEditingInvoice(true) }}
                        className="text-blue-500 text-xs hover:underline">
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
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded font-medium hover:bg-blue-700 transition-colors">
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
                  <input type="text" value={newUpc} onChange={e => setNewUpc(e.target.value)} inputMode="numeric"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code Date</label>
                  <input type="text" value={newCodeDate} onChange={e => setNewCodeDate(e.target.value)}
                    placeholder="e.g. 06127 or 11/15/26"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pallets</label>
                  <input type="number" value={newPallets} onChange={e => setNewPallets(e.target.value)} min="0" inputMode="numeric"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cases</label>
                  <input type="number" value={newCases} onChange={e => setNewCases(e.target.value)} min="0" inputMode="numeric"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Weight / Pallet</label>
                  <input type="text" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="e.g. 1,200 lbs"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="e.g. Freezer A-3"
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
                    <th className="text-left pb-2 pr-4">Plts</th>
                    <th className="text-left pb-2 pr-4">Cases</th>
                    <th className="text-left pb-2 pr-4">Code Date</th>
                    <th className="text-left pb-2 pr-4">Wt/Plt</th>
                    <th className="text-left pb-2 pr-4">Location</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id} className={editingItem === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      {editingItem === item.id ? (
                        <>
                          <td className="py-2 pr-4 font-mono font-bold text-blue-700">#{String(item.lot_number).padStart(5, '0')}</td>
                          {['description','upc','pallets','cases','code_date','weight_per_pallet','location'].map(field => (
                            <td key={field} className="py-2 pr-4">
                              <input
                                type={field === 'pallets' || field === 'cases' ? 'number' : 'text'}
                                value={editItemData[field] || ''}
                                onChange={e => setEditItemData(prev => ({ ...prev, [field]: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          ))}
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button onClick={() => saveItem(item.id)} className="text-blue-600 text-xs hover:underline">Save</button>
                              <button onClick={() => setEditingItem(null)} className="text-gray-400 text-xs hover:underline">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-4 font-mono font-bold text-blue-700">#{String(item.lot_number).padStart(5, '0')}</td>
                          <td className="py-2 pr-4 text-gray-800">{item.description || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.upc || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.pallets ?? '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.cases ?? '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.code_date || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.weight_per_pallet || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{item.location || '—'}</td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button onClick={() => openItemEdit(item)} className="text-blue-500 text-xs hover:underline">Edit</button>
                              <button onClick={() => deleteItem(item.id)} className="text-red-400 text-xs hover:underline">×</button>
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

        {/* Attachments */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Attachments ({attachments.length})</h2>
          </div>

          {attachments.length > 0 && (
            <ul className="divide-y divide-gray-100 mb-4">
              {attachments.map(att => (
                <li key={att.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeBadgeColor(att.file_type)}`}>
                      {typeLabel(att.file_type)}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{att.file_name}</span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => openAttachment(att)}
                      className="text-sm text-blue-600 hover:underline">Open</button>
                    <button onClick={() => deleteAttachment(att)}
                      className="text-sm text-red-400 hover:underline">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <select value={uploadType} onChange={e => setUploadType(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff"
              onChange={handleFileUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50">
              {uploading ? 'Uploading…' : '+ Attach File'}
            </button>
            <span className="text-xs text-gray-400">PDF, JPG, PNG accepted</span>
          </div>
        </div>

      </main>

      {/* ── Print layout — hidden on screen, visible on print ── */}
      <div className="hidden print:block p-6 text-sm">

        {/* Header */}
        <div className="text-center mb-1">
          <h1 className="text-xl font-bold tracking-wide">WAREHOUSE RECEIVING RECORD</h1>
          <p className="text-base font-semibold">NORTHEAST REFRIGERATED DIST. CO.</p>
          <p className="text-xs text-gray-500">978-851-4747 · FAX 978-863-9550</p>
        </div>

        {/* Shipment header fields */}
        <table className="w-full border-collapse border border-black text-xs mb-0">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1 w-24 font-semibold bg-gray-50">Account / Shipper</td>
              <td className="border border-black px-2 py-1 w-48">{log.vendor_name}</td>
              <td className="border border-black px-2 py-1 w-20 font-semibold bg-gray-50">Date</td>
              <td className="border border-black px-2 py-1 w-28">{log.received_date}</td>
              <td className="border border-black px-2 py-1 w-24 font-semibold bg-gray-50">Truck / Unit #</td>
              <td className="border border-black px-2 py-1">{log.truck_number || ''}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50">Carrier</td>
              <td className="border border-black px-2 py-1">{log.po_carrier || ''}</td>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50">P.O.</td>
              <td className="border border-black px-2 py-1">{log.po_carrier || ''}</td>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50">Permit # (DOT)</td>
              <td className="border border-black px-2 py-1">{log.dot_permit || ''}</td>
            </tr>
            {log.invoice_number && (
              <tr>
                <td className="border border-black px-2 py-1 font-semibold bg-gray-50">Invoice #</td>
                <td className="border border-black px-2 py-1" colSpan={5}>{log.invoice_number}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Product lines table */}
        <table className="w-full border-collapse border border-black text-xs mt-0">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-1 py-1 text-center">UPC</th>
              <th className="border border-black px-1 py-1 text-center">LOT #</th>
              <th className="border border-black px-1 py-1 text-center">Plts</th>
              <th className="border border-black px-1 py-1 text-center">Cases</th>
              <th className="border border-black px-1 py-1 text-center">Rec'd</th>
              <th className="border border-black px-1 py-1 text-center">Code Date</th>
              <th className="border border-black px-1 py-1 text-left">Description</th>
              <th className="border border-black px-1 py-1 text-center">Weigh Per Plt</th>
              <th className="border border-black px-1 py-1 text-left">Location</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="border border-black px-1 py-1.5 text-center">{item.upc || ''}</td>
                <td className="border border-black px-1 py-1.5 text-center font-bold">{String(item.lot_number).padStart(5, '0')}</td>
                <td className="border border-black px-1 py-1.5 text-center">{item.pallets ?? ''}</td>
                <td className="border border-black px-1 py-1.5 text-center">{item.cases ?? ''}</td>
                <td className="border border-black px-1 py-1.5 text-center">{item.cases ?? ''}</td>
                <td className="border border-black px-1 py-1.5 text-center">{item.code_date || ''}</td>
                <td className="border border-black px-1 py-1.5">{item.description || ''}</td>
                <td className="border border-black px-1 py-1.5 text-center">{item.weight_per_pallet || ''}</td>
                <td className="border border-black px-1 py-1.5">{item.location || ''}</td>
              </tr>
            ))}
            {/* Blank rows to pad the table */}
            {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
              <tr key={`blank-${i}`}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="border border-black px-1 py-3"></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Transport conditions */}
        <table className="w-full border-collapse border border-black text-xs mt-0">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50 w-48">
                Transportation Condition Of<br />Unit was Clean And<br />Exterior Of
              </td>
              <td className="border border-black px-2 py-1 w-24">
                Truck AND<br />
                <span className="font-bold">{log.transport_clean === true ? '✓ Yes' : log.transport_clean === false ? '✗ No' : ''}</span>
              </td>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50 w-48">
                With Proper ventilation without<br />Any inspected
              </td>
              <td className="border border-black px-2 py-1 w-24">
                <span className="font-bold">{log.transport_ventilation === true ? '✓ Yes' : log.transport_ventilation === false ? '✗ No' : ''}</span>
              </td>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50 w-32">Gaps Or Cracks</td>
              <td className="border border-black px-2 py-1">
                <span className="font-bold">{log.transport_no_damage === true ? '✓ Yes' : log.transport_no_damage === false ? '✗ No' : ''}</span>
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50">Product Condition</td>
              <td className="border border-black px-2 py-1">
                <span className="font-bold">{log.product_condition_ok === true ? '✓ OK' : log.product_condition_ok === false ? '✗ Not OK' : ''}</span>
              </td>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50">Safety Guidelines Followed</td>
              <td className="border border-black px-2 py-1">
                <span className="font-bold">{log.safety_guidelines_ok === true ? '✓ Yes' : log.safety_guidelines_ok === false ? '✗ No' : ''}</span>
              </td>
              <td className="border border-black px-2 py-1 font-semibold bg-gray-50">Comments</td>
              <td className="border border-black px-2 py-1">{log.comments || ''}</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <table className="w-full border-collapse border border-black text-xs mt-0">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-3 w-1/2">
                <span className="font-semibold">Rec'd by: </span>{log.received_by || ''}
              </td>
              <td className="border border-black px-2 py-3 w-1/2">
                <span className="font-semibold">Written up by: </span>{log.written_up_by || ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Attached documents list */}
        {attachments.length > 0 && (
          <div className="mt-4 text-xs text-gray-500">
            <p className="font-semibold mb-1">Attached documents:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {attachments.map(att => (
                <li key={att.id}>{typeLabel(att.file_type)}: {att.file_name}</li>
              ))}
            </ul>
          </div>
        )}

      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          @page { margin: 0.5in; }
        }
      `}</style>
    </div>
  )
}
