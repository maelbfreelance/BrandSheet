// Stripe Checkout pour les packs de crédits one-shot (page /dashboard/credits).
// Mode 'payment' (pas d'abonnement). À chaque paiement réussi, le webhook
// ajoute les crédits au solde de l'utilisateur.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { CREDIT_PACKS, getStripePackPriceId } from '@/lib/plans'

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: 'stripe_not_configured', message: "L'intégration Stripe n'est pas encore active." },
      { status: 503 },
    )
  }

  const { packId, userId } = (await req.json()) as { packId: string; userId: string }
  if (!packId || !userId) {
    return NextResponse.json({ error: 'packId et userId requis' }, { status: 400 })
  }

  const pack = CREDIT_PACKS.find((p) => p.id === packId)
  if (!pack) return NextResponse.json({ error: 'Pack inconnu' }, { status: 400 })

  const priceId = getStripePackPriceId(packId)
  if (!priceId) {
    return NextResponse.json(
      { error: 'price_id_missing', message: `Le price ID Stripe pour le pack ${packId} n'est pas configuré.` },
      { status: 503 },
    )
  }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      // Le webhook lit credits + kind pour créditer le bon nombre.
      metadata: { userId, packId, credits: String(pack.credits), kind: 'credits' },
      success_url: `${origin}/dashboard/credits?topped=${pack.credits}`,
      cancel_url: `${origin}/dashboard/credits?canceled=1`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe credits checkout error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'stripe_error', detail: message }, { status: 500 })
  }
}
