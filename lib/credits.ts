import { supabaseAdmin as supabase } from './supabase-admin'
import { PLANS, type PlanId } from './plans'

export const MODIFICATION_COST = 2
export const INITIAL_CREDITS = 20
/** Coût par document sélectionné dans la génération à la carte (qualité standard).
 *  Identique pour tous les plans. La qualité premium est facturée HIGH_QUALITY_COST. */
export const PER_DOC_COST = 4

export async function getCredits(userId: string): Promise<number> {
  const { data } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.credits ?? 0
}

export async function ensureCredits(userId: string): Promise<number> {
  const { data } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .maybeSingle()
  if (data) return data.credits
  await supabase
    .from('user_credits')
    .insert({ user_id: userId, credits: INITIAL_CREDITS })
  return INITIAL_CREDITS
}

export async function deductCredits(
  userId: string,
  amount: number,
): Promise<{ ok: boolean; remaining: number }> {
  const current = await getCredits(userId)
  if (current < amount) return { ok: false, remaining: current }
  const next = current - amount
  const { error } = await supabase
    .from('user_credits')
    .update({ credits: next, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) return { ok: false, remaining: current }
  return { ok: true, remaining: next }
}

export async function addCredits(userId: string, amount: number): Promise<number> {
  const current = await getCredits(userId)
  const next = current + amount
  await supabase
    .from('user_credits')
    .update({ credits: next, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  return next
}

/**
 * Refill mensuel cumulatif. Ajoute creditsPerMonth(plan) au solde si au moins
 * 1 mois calendaire s'est écoulé depuis le dernier refill (ou depuis le 1er
 * appel pour les nouveaux utilisateurs — ancrage à NOW() sans refill).
 *
 * Sémantique :
 * - 1 SEUL refill par appel, peu importe le temps écoulé.
 * - Pas de rattrapage des mois manqués (à clarifier dans les T&C).
 * - Cumul : les crédits s'additionnent au solde existant.
 * - Plan Starter inclus (10 crédits / mois ; 20 crédits initiaux à l'inscription
 *   via le trigger SQL, hors refill).
 *
 * Retourne le nombre de crédits ajoutés (0 si aucun refill dû).
 */

function addOneMonth(date: Date): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
}

export async function refillIfDue(userId: string): Promise<{ added: number; balance: number }> {
  // Récupère plan + dernier refill.
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, credits_last_refill_at')
    .eq('user_id', userId)
    .maybeSingle()

  const planId: PlanId = (profile?.plan && profile.plan in PLANS) ? (profile.plan as PlanId) : 'starter'
  const monthlyCredits = PLANS[planId].creditsPerMonth
  const now = new Date()
  const lastRefill = profile?.credits_last_refill_at ? new Date(profile.credits_last_refill_at) : null

  // 1ère fois : on ancre à maintenant, pas de refill (les crédits initiaux ont
  // déjà été crédités à la création de user_credits, on ne veut pas doubler).
  if (!lastRefill) {
    await supabase
      .from('profiles')
      .upsert({ user_id: userId, credits_last_refill_at: now.toISOString() }, { onConflict: 'user_id' })
    const balance = await getCredits(userId)
    return { added: 0, balance }
  }

  const nextDue = addOneMonth(lastRefill)
  if (now < nextDue) {
    const balance = await getCredits(userId)
    return { added: 0, balance }
  }

  // Refill dû : on ajoute monthlyCredits, on cale le prochain anchor à NOW.
  // (NOT lastRefill + 1 month — ça créerait un rattrapage en cas de longue absence.)
  const balance = await addCredits(userId, monthlyCredits)
  await supabase
    .from('profiles')
    .upsert({ user_id: userId, credits_last_refill_at: now.toISOString() }, { onConflict: 'user_id' })
  return { added: monthlyCredits, balance }
}
