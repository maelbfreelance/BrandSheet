import { createClient } from '@supabase/supabase-js'

// Client serveur — utilise la service_role key pour bypasser RLS.
// À n'importer QUE dans des routes API / code serveur.
export const supabaseAdmin = createClient(
  'https://aczakaoncltqrgxmlpxn.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
