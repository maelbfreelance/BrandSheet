export type PlanId = 'starter' | 'solo' | 'studio' | 'agency'

export type BillingCycle = 'monthly' | 'annual'

export type PlanInfo = {
  id: PlanId
  label: string
  /** Affichage par défaut (mensuel) — conservé pour compat. */
  price: string
  /** Tarif mensuel (engagement mensuel). */
  monthlyPrice: number
  /** Tarif mensuel équivalent quand facturé annuellement. */
  annualMonthlyPrice: number
  /** Total facturé en une fois sur 12 mois. */
  annualYearlyPrice: number
  /** Pourcentage économisé sur le cycle annuel vs mensuel. */
  annualSavingPct: number
  priceNumber: number // pour tri / comparaison
  tagline: string
  contacts: string
  /** null = illimité */
  contactLimit: number | null
  creditsPerMonth: number
  generationCost: number
  modifCost: number | null
  /** Coût d'une analyse/scraping APRÈS le 1er scraping gratuit. 0 = inclus. */
  scrapeCost: number
  retention: { kind: 'count' | 'days' | 'unlimited'; value: number }
  retentionLabel: string
  features: string[]
  popular?: boolean
}

/** Price IDs Stripe par plan/cycle. Lus depuis les env vars : permettent au
 *  squelette de fonctionner même sans Stripe configuré (undefined → la route
 *  /api/stripe/checkout renverra 503). */
export function getStripePriceId(planId: PlanId, cycle: BillingCycle): string | undefined {
  const upper = planId.toUpperCase()
  return cycle === 'annual'
    ? process.env[`STRIPE_PRICE_${upper}_ANNUAL`]
    : process.env[`STRIPE_PRICE_${upper}_MONTHLY`]
}

/** Packs de crédits one-shot (page /dashboard/credits). */
export type CreditPack = {
  id: string
  label: string
  credits: number
  price: number
  tag?: string
}
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', label: 'Starter', credits: 50, price: 9 },
  { id: 'pro', label: 'Pro', credits: 150, price: 19, tag: 'Populaire' },
  { id: 'studio', label: 'Studio', credits: 400, price: 39 },
]
export function getStripePackPriceId(packId: string): string | undefined {
  return process.env[`STRIPE_PRICE_PACK_${packId.toUpperCase()}`]
}

export const FREE_SCRAPE_LIMIT = 1

export const PLANS: Record<PlanId, PlanInfo> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    price: '0€',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualYearlyPrice: 0,
    annualSavingPct: 0,
    priceNumber: 0,
    tagline: 'Pour découvrir BrandSheet',
    contacts: '2',
    contactLimit: 2,
    creditsPerMonth: 20,
    generationCost: 10,
    modifCost: null,
    scrapeCost: 5,
    retention: { kind: 'count', value: 5 },
    retentionLabel: '5 derniers documents',
    features: [
      '2 contacts à vie',
      '20 crédits / mois',
      '1 analyse de marque gratuite, puis 5 crédits / analyse',
      'Génération HTML brandée',
      'Conservation : 5 derniers documents',
    ],
  },
  solo: {
    id: 'solo',
    label: 'Solo',
    price: '9,99€',
    monthlyPrice: 9.99,
    annualMonthlyPrice: 6.99,
    annualYearlyPrice: 83.88,
    annualSavingPct: 30,
    priceNumber: 9.99,
    tagline: 'Pour le freelance qui démarre',
    contacts: '10',
    contactLimit: 10,
    creditsPerMonth: 150,
    generationCost: 10,
    modifCost: 2,
    scrapeCost: 3,
    retention: { kind: 'days', value: 30 },
    retentionLabel: '30 jours',
    features: [
      '10 contacts',
      '150 crédits / mois',
      'Analyse de marque : 3 crédits',
      'Régénération de documents (2 crédits)',
      'CGV générées',
      'Devis professionnels',
      'Conservation 30 jours',
    ],
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    price: '19,99€',
    monthlyPrice: 19.99,
    annualMonthlyPrice: 13.99,
    annualYearlyPrice: 167.88,
    annualSavingPct: 30,
    priceNumber: 19.99,
    tagline: 'Pour le studio en croissance',
    contacts: '25',
    contactLimit: 25,
    creditsPerMonth: 600,
    generationCost: 10,
    modifCost: 2,
    scrapeCost: 2,
    retention: { kind: 'days', value: 365 },
    retentionLabel: '1 an',
    popular: true,
    features: [
      '25 contacts',
      '600 crédits / mois',
      'Analyse de marque : 2 crédits',
      'Régénération de documents (2 crédits)',
      'Conservation 1 an',
      'Toutes les fonctionnalités Solo',
      'Support prioritaire',
    ],
  },
  agency: {
    id: 'agency',
    label: 'Agency',
    price: '49,99€',
    monthlyPrice: 49.99,
    annualMonthlyPrice: 34.99,
    annualYearlyPrice: 419.88,
    annualSavingPct: 30,
    priceNumber: 49.99,
    tagline: 'Pour l\'agence sans limite',
    contacts: 'illimité',
    contactLimit: null,
    creditsPerMonth: 2000,
    generationCost: 10,
    modifCost: 2,
    scrapeCost: 0,
    retention: { kind: 'unlimited', value: 0 },
    retentionLabel: 'illimité',
    features: [
      'Contacts illimités',
      '2 000 crédits / mois',
      'Analyse de marque illimitée et gratuite',
      'Régénération de documents (2 crédits)',
      'Conservation illimitée',
      'Toutes les fonctionnalités Studio',
      'Accompagnement dédié',
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ['starter', 'solo', 'studio', 'agency']

export function applyRetention<T extends { created_at: string }>(docs: T[], plan: PlanId): T[] {
  const info = PLANS[plan] ?? PLANS.starter
  if (info.retention.kind === 'unlimited') return docs
  if (info.retention.kind === 'count') {
    return [...docs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, info.retention.value)
  }
  const cutoff = Date.now() - info.retention.value * 24 * 60 * 60 * 1000
  return docs.filter((d) => new Date(d.created_at).getTime() >= cutoff)
}

/** Format prix EUR avec virgule décimale, sans zéros traînants. */
export function formatEUR(amount: number): string {
  if (amount === 0) return '0€'
  return amount.toFixed(2).replace('.', ',').replace(/,00$/, '') + '€'
}
