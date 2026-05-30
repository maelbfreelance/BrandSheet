import { supabaseAdmin as supabase } from './supabase-admin'

export const MODIFICATION_COST = 2
export const INITIAL_CREDITS = 20
/** Coût par document sélectionné dans la génération à la carte. */
export const PER_DOC_COST = 2

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
