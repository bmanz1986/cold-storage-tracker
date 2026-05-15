#!/usr/bin/env node
/**
 * One-off importer: Google Sheet → public.inspections
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/import_inspections.js [--dry-run] [--csv path]
 *
 * Flags:
 *   --dry-run   Parse & validate but don't insert. Prints a summary.
 *   --csv PATH  Use a different CSV (default: scripts/inspections_export.csv)
 *   --batch N   Rows per insert batch (default: 200)
 *
 * Requires the SUPABASE_SERVICE_ROLE_KEY env var because RLS only allows
 * authenticated inserts (the anon key in lib/supabase.js can't write).
 * The service role key is in your Supabase dashboard → Project Settings → API.
 * Do NOT commit it. Treat it like a password.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// --- config ---
const SUPABASE_URL = 'https://lhgzhddcnzaszbmwxyel.supabase.co'  // matches lib/supabase.js
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const csvFlagIdx = args.indexOf('--csv')
const CSV_PATH = csvFlagIdx >= 0 ? args[csvFlagIdx + 1] : path.join(__dirname, 'inspections_export.csv')
const batchFlagIdx = args.indexOf('--batch')
const BATCH_SIZE = batchFlagIdx >= 0 ? parseInt(args[batchFlagIdx + 1], 10) : 200

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!DRY_RUN && !SERVICE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY (or pass --dry-run to validate without inserting).')
  console.error('Find it in Supabase dashboard → Project Settings → API → service_role secret.')
  process.exit(1)
}

// --- vendor normalization ---
// Known canonical names. Add new mappings as needed; anything missing falls
// through to a title-case heuristic.
const VENDOR_CANONICAL = {
  'jessica': 'Jessica',
  'stuffed foods': 'Stuffed Foods',
  'garlic king': 'Garlic King',
  'farmers & cooks': 'Farmers & Cooks',
  'nashoba': 'Nashoba Brook',
  'nashoba brook': 'Nashoba Brook',
  'galleria farms': 'Galleria Farms',
  'haddonfield': 'Haddonfield',
  'dumpling daughter': 'Dumpling Daughter',
  'papa\'s catch': "Papa's Catch",
  'engo impex inc': 'Engo impex Inc',
  'ct': 'CT - Shelton',
  'ct - shelton': 'CT - Shelton',
  'vermont packing house': 'Vermont Packing House',
  'family farmstead': 'Family Farmstead',
  'red\'s best': "Red's Best",
  'labelle poultry': 'LaBelle Poultry',
  'marksbury farms': 'Marksbury Farms',
  'marcho': 'Marcho',
  'dough connection': 'Dough Connection',
  'engo': 'Engo',
  'galleria': 'Galleria',
}

function normalizeVendor(s) {
  if (!s) return null
  const trimmed = String(s).trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase()
  if (VENDOR_CANONICAL[key]) return VENDOR_CANONICAL[key]
  // Title-case fallback
  return trimmed.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

// --- CSV parser (state machine, handles quoted fields with commas) ---
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { field += c }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
      else { field += c }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

// --- value parsers ---

function parseDateTime(dateStr, timeStr) {
  // dateStr: "1/2/2026", timeStr: "7:48:00 AM" — return ISO string, treat as America/New_York (Walden HQ).
  // We can't import a TZ library here, so we just build a local string and let Postgres treat it as UTC.
  // For ordering/searching purposes this is fine — drift is at most a few hours and is consistent.
  if (!dateStr) return null
  const [m, d, y] = dateStr.split('/').map(s => s.trim())
  if (!y) return null
  let hh = 0, mm = 0
  if (timeStr) {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i)
    if (match) {
      hh = parseInt(match[1], 10)
      mm = parseInt(match[2], 10)
      const ampm = (match[3] || '').toUpperCase()
      if (ampm === 'PM' && hh < 12) hh += 12
      if (ampm === 'AM' && hh === 12) hh = 0
    }
  }
  const pad = n => String(n).padStart(2, '0')
  // Build ISO without timezone — Supabase will store as timestamptz; this'll be interpreted as UTC.
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00Z`
}

function parseDateOnly(s) {
  if (!s) return null
  const [m, d, y] = String(s).split('/').map(x => x.trim())
  if (!y) return null
  const pad = n => String(n).padStart(2, '0')
  return `${y}-${pad(m)}-${pad(d)}`
}

function parseTemp(s) {
  // Accept "22", "22F", "-6", "-10", "amb", "n/a", "n.a", "n;a", ".", "", null
  if (s === null || s === undefined) return null
  const t = String(s).trim().toLowerCase()
  if (!t || t === 'amb' || t === 'n/a' || t === 'n.a' || t === 'n;a' || t === '.') return null
  const cleaned = t.replace(/f$/, '').replace(/[^0-9.\-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseBoolean(s) {
  // "Yes" → true, "No" → false, "N/A" or blank → null
  if (!s) return null
  const t = String(s).trim().toLowerCase()
  if (t === 'yes' || t === 'y' || t === 'true') return true
  if (t === 'no' || t === 'n' || t === 'false') return false
  return null
}

function parseTempRequired(s) {
  if (!s) return null
  const t = String(s).toLowerCase()
  if (t.includes('frozen')) return 'Frozen'
  if (t.includes('refrigerated')) return 'Refrigerated'
  if (t.includes('ambient')) return 'Ambient'
  return null
}

function parseDirection(s) {
  if (!s) return null
  const t = String(s).trim().toLowerCase()
  if (t === 'inbound') return 'Inbound'
  if (t === 'outbound') return 'Outbound'
  if (t === 'both') return 'Both'
  return null
}

function parseInspectionOk(s) {
  if (!s) return null
  const t = String(s).trim()
  if (!t) return null
  return t === 'No Non Conformances Identified'
}

function parseBolMatches(s) {
  if (!s) return null
  const t = String(s).trim().toLowerCase()
  if (t.startsWith('yes')) return true
  if (t.startsWith('no')) return false
  return null
}

function emptyToNull(s) {
  if (s === null || s === undefined) return null
  const t = String(s).trim()
  return t === '' ? null : t
}

// --- row mapping ---

function mapRow(r, rowNum, warnings) {
  // Column indices match the spreadsheet header order
  const [
    timestamp, date, time, carrier, team, name, inboundOutbound,
    vendorWalden, vendorColdStorage, orderPo, bolIncluded, lockedSealed, sealNum, sealMatches,
    tempRequired, setPoint, frozenActual, refrigActual, tempAcceptable,
    truckInspection, truckNcNotes, palletInspection, palletNcNotes, palletType,
    dateReceived, bolPo, vendorName, currentStatus,
    verifyBol, verifiedDate, verifiedInitials, bolMatches, ifNo,
  ] = r

  // Pick vendor: prefer Cold Storage, then Walden, then trailing "Vendor Name"
  const rawVendor = emptyToNull(vendorColdStorage) || emptyToNull(vendorWalden) || emptyToNull(vendorName)
  const vendor = normalizeVendor(rawVendor)
  if (!vendor) {
    warnings.push(`Row ${rowNum}: no vendor name — skipped`)
    return null
  }

  const vendorType = emptyToNull(vendorColdStorage)
    ? 'Cold Storage'
    : emptyToNull(vendorWalden) ? 'Walden' : null

  let direction = parseDirection(inboundOutbound)
  if (!direction) {
    // Schema requires NOT NULL; default to Inbound and warn so user can fix later
    warnings.push(`Row ${rowNum}: blank direction — defaulted to Inbound`)
    direction = 'Inbound'
  }

  return {
    inspected_at: parseDateTime(date, time) || parseDateTime(timestamp?.split(' ')[0], timestamp?.split(' ')[1]),
    team: emptyToNull(team),
    inspector_name: emptyToNull(name),
    carrier_name: emptyToNull(carrier),
    direction,
    vendor_name: vendor,
    vendor_type: vendorType,
    order_or_po: emptyToNull(orderPo) || emptyToNull(bolPo),
    bol_included: parseBoolean(bolIncluded),
    truck_locked_or_sealed: emptyToNull(lockedSealed),
    seal_number: emptyToNull(sealNum),
    seal_matches_paperwork: parseBoolean(sealMatches),
    temperature_required: parseTempRequired(tempRequired),
    set_point: parseTemp(setPoint),
    frozen_actual: parseTemp(frozenActual),
    refrigerated_actual: parseTemp(refrigActual),
    temperature_acceptable: parseBoolean(tempAcceptable),
    truck_inspection_ok: parseInspectionOk(truckInspection),
    truck_nc_notes: emptyToNull(truckNcNotes),
    pallet_inspection_ok: parseInspectionOk(palletInspection),
    pallet_nc_notes: emptyToNull(palletNcNotes),
    pallet_type: emptyToNull(palletType),
    bol_verify_link: emptyToNull(verifyBol),
    bol_verified_date: parseDateOnly(verifiedDate),
    bol_verified_initials: emptyToNull(verifiedInitials),
    bol_matches_product: parseBolMatches(bolMatches),
    bol_match_explanation: emptyToNull(ifNo),
  }
}

// --- main ---

async function main() {
  const startTime = Date.now()
  console.log(`Reading CSV: ${CSV_PATH}`)
  const text = fs.readFileSync(CSV_PATH, 'utf8')
  const allRows = parseCsv(text)
  if (allRows.length < 2) {
    console.error('CSV has no data rows.')
    process.exit(1)
  }
  const header = allRows[0]
  console.log(`Header columns: ${header.length}`)
  if (header.length !== 33) {
    console.warn(`WARNING: expected 33 columns, got ${header.length}. Field mapping may be off.`)
  }
  const dataRows = allRows.slice(1).filter(r => r.some(c => c && c.trim()))
  console.log(`Data rows: ${dataRows.length}`)

  const warnings = []
  const mapped = []
  dataRows.forEach((r, idx) => {
    const m = mapRow(r, idx + 2, warnings)  // +2 because row 1 is header
    if (m) mapped.push(m)
  })

  console.log(`Mapped: ${mapped.length} rows`)
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`)
    warnings.slice(0, 20).forEach(w => console.log('  ' + w))
    if (warnings.length > 20) console.log(`  …and ${warnings.length - 20} more`)
  }

  // Distinct vendors after normalization
  const vendorCounts = {}
  mapped.forEach(m => { vendorCounts[m.vendor_name] = (vendorCounts[m.vendor_name] || 0) + 1 })
  const sortedVendors = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])
  console.log(`\nDistinct vendors after normalization: ${sortedVendors.length}`)
  sortedVendors.slice(0, 15).forEach(([v, n]) => console.log(`  ${n.toString().padStart(4)}  ${v}`))
  if (sortedVendors.length > 15) console.log(`  …and ${sortedVendors.length - 15} more`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No data inserted. Re-run without --dry-run to import.')
    console.log(`Sample mapped row:`)
    console.log(JSON.stringify(mapped[0], null, 2))
    return
  }

  // Insert in batches
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  console.log(`\nInserting ${mapped.length} rows in batches of ${BATCH_SIZE}…`)
  let inserted = 0
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('inspections').insert(batch)
    if (error) {
      console.error(`\nERROR at batch starting row ${i + 1}: ${error.message}`)
      console.error('Aborting. Already inserted:', inserted)
      process.exit(1)
    }
    inserted += batch.length
    process.stdout.write(`\r  ${inserted}/${mapped.length}`)
  }
  console.log(`\n\nDone. Inserted ${inserted} rows in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`)
}

main().catch(e => { console.error(e); process.exit(1) })
