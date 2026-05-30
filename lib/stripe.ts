// Client Stripe initialisé paresseusement côté serveur uniquement. On lit la
// clé secrète au 1er appel pour éviter de planter le build s'il manque encore
// la variable d'env (squelette en attente de finalisation Stripe).
import Stripe from 'stripe'

let _client: Stripe | null = null

export function getStripe(): Stripe {
  if (_client) return _client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante — voir SETUP_STRIPE.md')
  _client = new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
  return _client
}

/** Renvoie true si l'intégration Stripe est configurée (clé + au moins 1 prix). */
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
