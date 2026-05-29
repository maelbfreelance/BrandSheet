export type PlanId = 'starter' | 'solo' | 'studio' | 'agency'

export type PlanInfo = {
  id: PlanId
  label: string
  price: string
  contacts: string
  creditsPerMonth: number
  generationCost: number
  modifCost: number | null
  retention: { kind: 'count' | 'days' | 'unlimited'; value: number }
  retentionLabel: string
}

export const PLANS: Record<PlanId, PlanInfo> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    price: '0€',
    contacts: '2',
    creditsPerMonth: 20,
    generationCost: 10,
    modifCost: null,
    retention: { kind: 'count', value: 5 },
    retentionLabel: '5 derniers documents',
  },
  solo: {
    id: 'solo',
    label: 'Solo',
    price: '9,99€',
    contacts: '15',
    creditsPerMonth: 150,
    generationCost: 10,
    modifCost: 2,
    retention: { kind: 'days', value: 30 },
    retentionLabel: '30 jours',
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    price: '19,99€',
    contacts: '50',
    creditsPerMonth: 600,
    generationCost: 10,
    modifCost: 2,
    retention: { kind: 'days', value: 365 },
    retentionLabel: '1 an',
  },
  agency: {
    id: 'agency',
    label: 'Agency',
    price: '49,99€',
    contacts: 'illimité',
    creditsPerMonth: 2000,
    generationCost: 10,
    modifCost: 2,
    retention: { kind: 'unlimited', value: 0 },
    retentionLabel: 'illimité',
  },
}

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
