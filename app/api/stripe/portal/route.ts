// Portail de facturation Stripe : permet à l'utilisateur de gérer son
// abonnement (changer de plan, annuler, mettre à jour la CB, voir les
// factures) depuis une session hébergée par Stripe.
import { NextResponse } from 'next/server'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
  }

  const { userId } = (await req.json()) as { userId: string }
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  // Le customer Stripe est créé à la 1ère Checkout. On retrouve l'email Supabase
  // et on cherche le customer correspondant. Pour un setup propre on stockerait
  // stripe_customer_id sur profiles à la souscription — TODO.
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (!email) return NextResponse.json({ error: 'email introuvable' }, { status: 400 })

  try {
    const customers = await getStripe().customers.list({ email, limit: 1 })
    const customer = customers.data[0]
    if (!customer) {
      return NextResponse.json({ error: 'no_customer', message: "Aucun abonnement Stripe associé à ce compte." }, { status: 404 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const session = await getStripe().billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/dashboard`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe portal error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'stripe_error', detail: message }, { status: 500 })
  }
}
