// Régénération complète d'un document (texte + scène image régénérée)
// Coût : 2 crédits. Bloqué pour le plan Starter.
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MODIFICATION_COST, getCredits, deductCredits } from '@/lib/credits'
import {
  buildDocPrompts,
  buildHtml,
  buildScenePrompt,
  generateSceneImage,
  sanitizeBody,
} from '@/lib/doc-render'

export async function POST(req: Request) {
  const { docId } = await req.json()
  if (!docId) return NextResponse.json({ error: 'docId requis' }, { status: 400 })

  try {
    const { data: doc } = await supabaseAdmin.from('documents').select('*').eq('id', docId).maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

    const { data: contact } = await supabaseAdmin.from('contacts').select('*').eq('id', doc.contact_id).maybeSingle()
    if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

    const userId = contact.user_id

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    const plan = profile?.plan || 'starter'
    const accountType: 'freelance' | 'brand' = profile?.account_type === 'brand' ? 'brand' : 'freelance'
    if (plan === 'starter') {
      return NextResponse.json(
        { error: 'plan_required', message: 'La régénération nécessite un plan payant (Solo et plus).' },
        { status: 403 },
      )
    }

    const credits = await getCredits(userId)
    if (credits < MODIFICATION_COST) {
      return NextResponse.json(
        { error: 'insufficient_credits', message: `Il vous reste ${credits} crédits. La régénération en coûte ${MODIFICATION_COST}.`, credits, required: MODIFICATION_COST },
        { status: 402 },
      )
    }

    let operation: any = null
    if (doc.operation_id) {
      const { data: op } = await supabaseAdmin.from('operations').select('*').eq('id', doc.operation_id).maybeSingle()
      operation = op
    }

    // Régen : nouvelle scène obligatoire SAUF pour 'nouveaute' qui n'utilise
    // pas la scène IA (image produit originale). Si échec, on annule avant débit.
    const needsScene = doc.type !== 'nouveaute'
    let sceneUrl: string | null = operation?.background_image_url || null
    if (needsScene && operation) {
      const refs: string[] = Array.isArray(operation.images) ? operation.images.filter(Boolean) : []
      if (refs.length === 0) {
        return NextResponse.json(
          { error: 'missing_product_image', message: "Ajoute au moins une photo du produit/service à l'opération avant de régénérer." },
          { status: 400 },
        )
      }
      sceneUrl = await generateSceneImage(buildScenePrompt(contact, operation, accountType), refs, userId, operation.id)
      await supabaseAdmin
        .from('operations')
        .update({ background_image_url: sceneUrl })
        .eq('id', operation.id)
    }
    const productImageUrl: string | null = Array.isArray(operation?.images) && operation.images.length > 0
      ? operation.images[0]
      : null

    const prompts = buildDocPrompts(contact, profile, operation, { accountType })
    const prompt = prompts[doc.type]
    if (!prompt) return NextResponse.json({ error: 'Type de document inconnu' }, { status: 400 })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt + ' Varie le style par rapport à toute version précédente.' }],
    })
    const content = message.content[0]
    if (content.type !== 'text') return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 })

    const bodyHtml = sanitizeBody(content.text)
    const fullHtml = buildHtml({ brand: contact, profile, docType: doc.type, sceneUrl, bodyHtml, productImageUrl, accountType })

    await supabaseAdmin.from('documents').update({ content: fullHtml, created_at: new Date().toISOString() }).eq('id', docId)

    const deduction = await deductCredits(userId, MODIFICATION_COST)

    return NextResponse.json({ success: true, content: fullHtml, credits: deduction.remaining })
  } catch (error) {
    console.error('Regen error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Erreur régénération', detail: message }, { status: 500 })
  }
}
