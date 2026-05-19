import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function POST(request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_SHEET_ID) {
    return NextResponse.json({ ok: false, error: 'Google Sheets not configured' }, { status: 500 })
  }

  try {
    const { item, log } = await request.json()

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Match existing column layout: A=UPC, B="", C="", D=Lot#, E=Cases, F=Date rec'v, G=Code Date, H=Cust
    const row = [
      item.upc || '',
      '',
      '',
      String(item.lot_number).padStart(5, '0'),
      item.cases || '',
      log.received_date || '',
      item.code_date || '',
      log.vendor_name || '',
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:H',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Lot book sync error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
