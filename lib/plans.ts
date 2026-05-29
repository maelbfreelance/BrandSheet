export type PlanId = 'starter' | 'solo' | 'studio' | 'agency'

export type PlanInfo = {
  id: PlanId
  label: string
  price: string
  priceNumber: number // pour tri / comparaison
  tagline: string
  contacts: string
  creditsPerMonth: number
  generationCost: number
  modifCost: number | null
  retention: { kind: 'count' | 'days' | 'unlimited'; value: number }
  retentionLabel: string
  features: string[]
  popular?: boolean
}

export const PLANS: Record<PlanId, PlanInfo> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    price: '0€',
    priceNumber: 0,
    tagline: 'Pour découvrir BrandSheet',
    contacts: '2',
    creditsPerMonth: 20,
    generationCost: 10,
    modifCost: null,
    retention: { kind: 'count', value: 5 },
    retentionLabel: '5 derniers documents',
    features: [
      '2 contacts à vie',
      '20 crédits / mois',
      'Analyse de marque par IA',
      'Génération HTML brandée',
      'Conservation : 5 derniers documents',
    ],
  },
  solo: {
    id: 'solo',
    label: 'Solo',
    price: '9,99€',
    priceNumber: 9.99,
    tagline: 'Pour le freelance qui démarre',
    contacts: '15',
    creditsPerMonth: 150,
    generationCost: 10,
    modifCost: 2,
    retention: { kind: 'days', value: 30 },
    retentionLabel: '30 jours',
    features: [
      '15 contacts',
      '150 crédits / mois',
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
    priceNumber: 19.99,
    tagline: 'Pour le studio en croissance',
    contacts: '50',
    creditsPerMonth: 600,
    generationCost: 10,
    modifCost: 2,
    retention: { kind: 'days', value: 365 },
    retentionLabel: '1 an',
    popular: true,
    features: [
      '50 contacts',
      '600 crédits / mois',
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
    priceNumber: 49.99,
    tagline: 'Pour l\'agence sans limite',
    contacts: 'illimité',
    creditsPerMonth: 2000,
    generationCost: 10,
    modifCost: 2,
    retention: { kind: 'unlimited', value: 0 },
    retentionLabel: 'illimité',
    features: [
      'Contacts illimités',
      '2 000 crédits / mois',
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
