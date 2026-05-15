# Scripts

## `import_inspections.js`

One-off importer that loads the historical truck-inspection data from the Google
Sheet into the `public.inspections` table.

### What it does

- Parses `scripts/inspections_export.csv` (an export of the Google Sheet).
- Normalizes vendor names — `jessica` and `Jessica` collapse to `Jessica`,
  `stuffed foods` to `Stuffed Foods`, etc. See `VENDOR_CANONICAL` in the script
  to add more mappings.
- Maps the 33 spreadsheet columns into the `inspections` schema, parsing
  temperatures (`"22F"` → `22`, `"amb"` → `null`), booleans (`Yes/No`), dates,
  and the inspection-status text.
- Bulk-inserts in batches of 200 using your Supabase **service-role** key
  (RLS only allows authenticated writes; the service-role key bypasses RLS).

### Before you run it

1. Make sure migration `001_inspections.sql` has been applied (table must exist).
2. Grab your service-role key:
   - Supabase dashboard → **Project Settings** → **API** → **service_role secret**.
   - **Treat this key like a password.** Anyone with it can read or write any
     table, ignoring RLS. Do not commit it. Do not paste it in chat.

### Run it

Dry-run first to see what would happen — no database writes:

```bash
node scripts/import_inspections.js --dry-run
```

You'll get a summary: row count, warnings, distinct vendors after
normalization, and a sample mapped row.

When the dry-run looks right, do the real import (one-time):

**macOS / Linux:**
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... node scripts/import_inspections.js
```

**Windows PowerShell:**
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOi..."
node scripts/import_inspections.js
```

**Windows cmd:**
```cmd
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
node scripts/import_inspections.js
```

### Flags

| Flag | Purpose | Default |
|---|---|---|
| `--dry-run` | Parse & validate but don't insert | off |
| `--csv PATH` | Use a different CSV file | `scripts/inspections_export.csv` |
| `--batch N` | Rows per insert batch | `200` |

### Re-running

The script does not deduplicate. If you run it twice you'll get every row
twice. If you need to re-run, clear the table first in the Supabase SQL editor:

```sql
truncate public.inspections;
```

### Refreshing the CSV

To pull a fresh export from the Google Sheet:
1. Open the sheet → **File** → **Download** → **Comma-separated values (.csv)**.
2. Save over `scripts/inspections_export.csv`.
3. Re-run the importer.
