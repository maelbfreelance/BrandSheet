// Stripe Checkout pour les abonnements (Solo/Studio/Agency, mensuel ou annuel).
// Squelette : nécessite STRIPE_SECRET_KEY + STRIPE_PRICE_<PLAN>_<CYCLE> dans
// l'env (voir SETUP_STRIPE.md). Tant que ce n'est pas configuré, renvoie 503.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { PLANS, PlanId, BillingCycle, getStripePriceId } from '@/lib/plans'

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: 'stripe_not_configured', message: "L'intégration Stripe n'est pas encore active. STRIPE_SECRET_KEY manquante." },
      { status: 503 },
    )
  }

  const { planId, cycle, userId } = (await req.json()) as { planId: PlanId; cycle: BillingCycle; userId: string }

  if (!planId || !cycle || !userId) {
    return NextResponse.json({ error: 'planId, cycle et userId requis' }, { status: 400 })
  }
  if (!(planId in PLANS) || planId === 'starter') {
    return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
  }
  if (cycle !== 'monthly' && cycle !== 'annual') {
    return NextResponse.json({ error: 'cycle invalide' }, { status: 400 })
  }

  const priceId = getStripePriceId(planId, cycle)
  if (!priceId) {
    return NextResponse.json(
      { error: 'price_id_missing', message: `Le price ID Stripe pour ${planId} (${cycle}) n'est pas configuré. Voir SETUP_STRIPE.md.` },
      { status: 503 },
    )
  }

  // Récupère l'email utilisateur pour pré-remplir Stripe Checkout.
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = userData?.user?.email

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      // metadata répliquée sur la subscription pour que le webhook puisse
      // retrouver l'utilisateur et le plan visé sans dépendre du customer.
      metadata: { userId, planId, cycle, kind: 'subscription' },
      subscription_data: {
        metadata: { userId, planId, cycle },
      },
      success_url: `${origin}/dashboard?subscribed=${planId}`,
      cancel_url: `${origin}/pricing?canceled=1`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'stripe_error', detail: message }, { status: 500 })
  }
}
