import { google } from 'googleapis'
import { NextResponse } from 'next/server'

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function isConfigured() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHEET_ID)
}

// GET — returns the last filled-out lot number (last row that has a UPC or cases entered,
// ignoring blank placeholder rows that were pre-entered for upcoming work)
export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ lastLot: null, configured: false })
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:H',
    })

    const rows = data.values || []
    let lastFilledLot = null

    // Skip header row (index 0). A "filled out" row has data in column A (UPC) or column E (Cases).
    // Column D (index 3) = lot number, Column A (index 0) = UPC, Column E (index 4) = Cases
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const lotRaw = row[3]
      const upc = (row[0] || '').trim()
      const cases = (row[4] || '').trim()
      if (!lotRaw) continue
      const lotNum = parseInt(String(lotRaw).replace(/\D/g, ''), 10)
      if (isNaN(lotNum)) continue
      // Only count this row if it has actual data beyond just the lot number
      if (upc || cases) {
        if (lastFilledLot === null || lotNum > lastFilledLot) {
          lastFilledLot = lotNum
        }
      }
    }

    return NextResponse.json({ lastLot: lastFilledLot, configured: true })
  } catch (err) {
    console.error('Lot book read error:', err.message)
    return NextResponse.json({ lastLot: null, configured: true, error: err.message })
  }
}

// POST — writes a new lot item to the sheet.
// If a row with that lot number already exists (pre-entered placeholder), fills it in.
// Otherwise appends a new row.
export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json({ ok: false, error: 'Google Sheets not configured' }, { status: 500 })
  }

  try {
    const { item, log } = await request.json()
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const lotStr = String(item.lot_number).padStart(5, '0')

    // Column layout: A=UPC, B="", C="", D=Lot#, E=Cases, F=Date rec'v, G=Code Date, H=Cust
    const rowData = [
      item.upc || '',
      '',
      '',
      lotStr,
      item.cases != null ? String(item.cases) : '',
      log.received_date || '',
      item.code_date || '',
      log.vendor_name || '',
    ]

    // Read column D to find if this lot number already has a row
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'D:D',
    })
    const colD = data.values || []
    let existingRowIndex = -1
    for (let i = 1; i < colD.length; i++) {
      const cell = (colD[i]?.[0] || '').trim()
      const cellNum = parseInt(cell.replace(/\D/g, ''), 10)
      if (cellNum === item.lot_number) {
        existingRowIndex = i + 1 // Sheets rows are 1-indexed
        break
      }
    }

    if (existingRowIndex > 0) {
      // Update the existing pre-entered row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `A${existingRowIndex}:H${existingRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      })
    } else {
      // No pre-entered row — append
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A:H',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Lot book sync error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
