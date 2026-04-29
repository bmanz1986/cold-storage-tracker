import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://lhgzhddcnzaszbmwxyel.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3poZGRjbnphc3pibXd4eWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzgwMTYsImV4cCI6MjA5MzA1NDAxNn0.3swmW7jHoKiFMC_xbjK-RokY362-bl1kTJVAmioQaGc'
)
