// Toggle account_type ('freelance' | 'brand') côté serveur.
// La colonne est exclue des GRANT UPDATE côté client (cf. SETUP.sql) pour
// éviter qu'un user n'influence directement le rendu via la console
// Supabase. On passe donc obligatoirement par supabaseAdmin.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const VALID = new Set(['freelance', 'brand'])

export async function POST(req: Request) {
  const { userId, accountType } = (await req.json()) as { userId?: string; accountType?: string }
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  if (!accountType || !VALID.has(accountType)) {
    return NextResponse.json({ error: 'accountType doit être "freelance" ou "brand"' }, { status: 400 })
  }
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ account_type: accountType, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 })
    return NextResponse.json({ success: true, accountType })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'server_error', detail: message }, { status: 500 })
  }
}
