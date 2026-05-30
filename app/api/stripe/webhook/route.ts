// Webhook Stripe : 1 endpoint pour les abonnements ET les packs de crédits.
// Stripe exige le body brut pour la vérification HMAC, donc on lit le stream
// directement (pas req.json()) et on utilise constructEvent.
//
// Configuration : créer le webhook dans le dashboard Stripe pointant sur
// https://<domain>/api/stripe/webhook, copier le signing secret dans
// STRIPE_WEBHOOK_SECRET.
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { addCredits } from '@/lib/credits'

export const runtime = 'nodejs'
// Désactive le parsing automatique du body pour récupérer le raw text.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET manquante' }, { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'signature manquante' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error('Stripe webhook signature invalide:', err)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const kind = session.metadata?.kind
        const userId = session.metadata?.userId
        if (!userId) {
          console.warn('checkout.session.completed sans userId metadata, ignoré')
          break
        }
        if (kind === 'subscription') {
          const planId = session.metadata?.planId
          if (planId) {
            await supabaseAdmin
              .from('profiles')
              .upsert({ user_id: userId, plan: planId }, { onConflict: 'user_id' })
          }
        } else if (kind === 'credits') {
          const credits = parseInt(session.metadata?.credits || '0', 10)
          if (credits > 0) {
            await addCredits(userId, credits)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          // Retombe sur le plan Starter à la fin de l'abonnement.
          await supabaseAdmin
            .from('profiles')
            .upsert({ user_id: userId, plan: 'starter' }, { onConflict: 'user_id' })
        }
        break
      }

      case 'customer.subscription.updated': {
        // Changements de cycle ou de plan via le portail client.
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        const planId = sub.metadata?.planId
        if (userId && planId && sub.status === 'active') {
          await supabaseAdmin
            .from('profiles')
            .upsert({ user_id: userId, plan: planId }, { onConflict: 'user_id' })
        }
        break
      }

      default:
        // On laisse passer les autres événements sans rien faire.
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'handler_error', detail: message }, { status: 500 })
  }
}
