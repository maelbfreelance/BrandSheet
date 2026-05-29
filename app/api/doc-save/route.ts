// Sauvegarde des modifications manuelles d'un document (gratuit)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const { docId, content } = await req.json()
  if (!docId || typeof content !== 'string') {
    return NextResponse.json({ error: 'docId et content requis' }, { status: 400 })
  }
  if (content.length > 500_000) {
    return NextResponse.json({ error: 'Document trop volumineux' }, { status: 413 })
  }
  const { error } = await supabaseAdmin.from('documents').update({ content }).eq('id', docId)
  if (error) {
    return NextResponse.json({ error: 'Sauvegarde impossible', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
