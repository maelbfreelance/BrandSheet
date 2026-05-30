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

/** Packs de crédits one-shot (page /dashboard/credits).
 *
 *  Progression des crédits/€ calibrée pour que le prix unitaire d'un crédit
 *  acheté en pack reste TOUJOURS supérieur au prix unitaire d'un crédit fourni
 *  par un abonnement — l'objectif est que l'abonnement reste l'option la plus
 *  économique. Référence basse (plan Solo) : 150 c / 9,99 € = 15,02 c/€.
 *  Plus gros pack (99,99 €) : 1300 c → 13 c/€ (+15% au crédit vs Solo). */
export type CreditPack = {
  id: string
  label: string
  credits: number
  price: number
  tag?: string
}
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'p10',  label: 'Pack 10€',  credits: 100,  price: 9.99 },
  { id: 'p20',  label: 'Pack 20€',  credits: 215,  price: 19.99, tag: 'Populaire' },
  { id: 'p30',  label: 'Pack 30€',  credits: 335,  price: 29.99 },
  { id: 'p40',  label: 'Pack 40€',  credits: 465,  price: 39.99 },
  { id: 'p50',  label: 'Pack 50€',  credits: 600,  price: 49.99 },
  { id: 'p60',  label: 'Pack 60€',  credits: 740,  price: 59.99 },
  { id: 'p80',  label: 'Pack 80€',  credits: 1020, price: 79.99 },
  { id: 'p100', label: 'Pack 100€', credits: 1300, price: 99.99, tag: 'Meilleure valeur' },
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
    creditsPerMonth: 10,
    generationCost: 10,
    modifCost: null,
    scrapeCost: 5,
    retention: { kind: 'count', value: 5 },
    retentionLabel: '5 derniers documents',
    features: [
      '2 contacts à vie',
      '20 crédits offerts à l\'inscription, puis 10 / mois (cumul possible, mois sans login perdus)',
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
    creditsPerMonth: 100,
    generationCost: 10,
    modifCost: 2,
    scrapeCost: 3,
    retention: { kind: 'days', value: 30 },
    retentionLabel: '30 jours',
    features: [
      '10 contacts',
      '100 crédits / mois (cumul possible)',
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
    creditsPerMonth: 300,
    generationCost: 10,
    modifCost: 2,
    scrapeCost: 2,
    retention: { kind: 'days', value: 365 },
    retentionLabel: '1 an',
    popular: true,
    features: [
      '25 contacts',
      '300 crédits / mois (cumul possible)',
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
    price: '59,99€',
    monthlyPrice: 59.99,
    annualMonthlyPrice: 41.99,
    annualYearlyPrice: 503.88,
    annualSavingPct: 30,
    priceNumber: 59.99,
    tagline: 'Pour l\'agence sans limite',
    contacts: 'illimité',
    contactLimit: null,
    creditsPerMonth: 1000,
    generationCost: 10,
    modifCost: 2,
    scrapeCost: 0,
    retention: { kind: 'unlimited', value: 0 },
    retentionLabel: 'illimité',
    features: [
      'Contacts illimités',
      '1 000 crédits / mois (cumul possible)',
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
