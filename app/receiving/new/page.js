'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function NewReceivingForm() {
  const [user, setUser] = useState(null)
  const [saving, setSaving] = useState(false)

  const [vendor, setVendor] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [truck, setTruck] = useState('')
  const [dot, setDot] = useState('')
  const [poCarrier, setPoCarrier] = useState('')
  const [transportClean, setTransportClean] = useState('')
  const [transportVent, setTransportVent] = useState('')
  const [transportNoDamage, setTransportNoDamage] = useState('')
  const [productOk, setProductOk] = useState('')
  const [safetyOk, setSafetyOk] = useState('')
  const [comments, setComments] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [writtenBy, setWrittenBy] = useState('')
  const [teamMembers, setTeamMembers] = useState([])

  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        const v = searchParams.get('vendor')
        if (v) setVendor(v)
      }
    })
    supabase.from('team_members').select('display_name').eq('active', true).eq('show_in_ops', true).order('display_name')
      .then(({ data }) => { if (data) setTeamMembers(data.map(r => r.display_name)) })
  }, [router, searchParams])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const arrivalId = searchParams.get('arrival') || null
    const toBool = v => v === 'true' ? true : v === 'false' ? false : null
    const { data, error } = await supabase.from('receiving_logs').insert({
      arrival_id: arrivalId,
      vendor_name: vendor,
      received_date: date,
      truck_number: truck || null,
      dot_permit: dot || null,
      po_carrier: poCarrier || null,
      transport_clean: toBool(transportClean),
      transport_ventilation: toBool(transportVent),
      transport_no_damage: toBool(transportNoDamage),
      product_condition_ok: toBool(productOk),
      safety_guidelines_ok: toBool(safetyOk),
      comments: comments || null,
      received_by: receivedBy || null,
      written_up_by: writtenBy || null,
      created_by: user.id,
      status: 'receiving',
    }).select().single()

    if (error) {
      alert('Could not create log: ' + error.message)
      setSaving(false)
    } else {
      router.push(`/receiving/${data.id}`)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/receiving" className="text-gray-400 hover:text-gray-600 text-sm">← Receiving Log</Link>
          <h1 className="text-xl font-bold text-gray-800">Start Receiving Log</h1>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="text-sm text-red-600 hover:underline">Switch User</button>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-6">Fill in the shipment details. You'll add individual product lines (with auto-assigned lot numbers) on the next screen.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                <input type="text" value={vendor} onChange={e => setVendor(e.target.value)}
                  placeholder="e.g. Galleria Farms"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Received <span className="text-red-500">*</span></label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Truck #</label>
                <input type="text" value={truck} onChange={e => setTruck(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DOT Permit</label>
                <input type="text" value={dot} onChange={e => setDot(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO / Carrier</label>
                <input type="text" value={poCarrier} onChange={e => setPoCarrier(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Transport Conditions</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Transport Clean', transportClean, setTransportClean],
                ['Ventilation OK', transportVent, setTransportVent],
                ['No Damage', transportNoDamage, setTransportNoDamage],
                ['Product Condition OK', productOk, setProductOk],
                ['Safety Guidelines OK', safetyOk, setSafetyOk],
              ].map(([label, val, setter]) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <select value={val} onChange={e => setter(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                <select value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select --</option>
                  {teamMembers.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Written Up By</label>
                <select value={writtenBy} onChange={e => setWrittenBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select --</option>
                  {teamMembers.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <button type="submit" disabled={saving}
              className="w-full bg-orange-600 text-white py-2 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
              {saving ? 'Creating…' : 'Create Log & Add Items →'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default function NewReceivingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>}>
      <NewReceivingForm />
    </Suspense>
  )
}
