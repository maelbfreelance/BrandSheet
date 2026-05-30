// Refill mensuel cumulatif des crédits — appelé à chaque mount du dashboard.
// Cf. lib/credits.ts → refillIfDue() pour la sémantique (1 refill / mois
// calendaire, pas de rattrapage, cumul au solde existant).
import { NextResponse } from 'next/server'
import { refillIfDue } from '@/lib/credits'

export async function POST(req: Request) {
  const { userId } = (await req.json()) as { userId?: string }
  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }
  try {
    const result = await refillIfDue(userId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Refill error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'refill_error', detail: message }, { status: 500 })
  }
}
