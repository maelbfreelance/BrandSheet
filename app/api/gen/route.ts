// Génération à la carte : l'utilisateur sélectionne 1 ou plusieurs types de
// documents, on facture PER_DOC_COST crédits par document généré. Les types
// 'mail_*' nécessitent un plan payant. La scène image (gpt-image-1) n'est
// générée que si au moins un doc en a besoin (toutes les fiches sauf
// 'nouveaute' qui utilise l'image originale uploadée).
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PER_DOC_COST, getCredits, deductCredits } from '@/lib/credits'
import {
  ACTIVE_DOC_TYPES,
  MAIL_DOC_TYPES,
  buildDocPrompts,
  buildHtml,
  buildScenePrompt,
  generateSceneImage,
  sanitizeBody,
} from '@/lib/doc-render'

const NOUVEAUTE_TYPES = new Set(['nouveaute'])

export async function POST(req: Request) {
  const { contactId, operationId, types, dealText, forceSceneRefresh } = await req.json()

  if (!contactId) {
    return NextResponse.json({ error: 'contactId requis' }, { status: 400 })
  }

  // Validation des types : au moins 1, seulement des types actifs connus.
  const validTypes = Array.isArray(types)
    ? Array.from(new Set(types.filter((t: any) => typeof t === 'string' && (ACTIVE_DOC_TYPES as readonly string[]).includes(t))))
    : []
  if (validTypes.length === 0) {
    return NextResponse.json({ error: 'no_types', message: 'Sélectionne au moins 1 document à générer.' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  try {
    const { data: contact, error: contactErr } = await supabaseAdmin.from('contacts').select('*').eq('id', contactId).maybeSingle()
    if (contactErr) return NextResponse.json({ error: 'Erreur lecture contact', detail: contactErr.message }, { status: 500 })
    if (!contact) return NextResponse.json({ error: 'Contact introuvable', detail: `id=${contactId}` }, { status: 404 })

    let operation: any = null
    if (operationId) {
      const { data: op } = await supabaseAdmin.from('operations').select('*').eq('id', operationId).eq('contact_id', contactId).maybeSingle()
      if (!op) return NextResponse.json({ error: 'Opération introuvable pour ce contact' }, { status: 404 })
      operation = op
    }

    const userId = contact.user_id

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    const plan = profile?.plan || 'starter'

    // Gating mails : plan payant requis.
    const hasMail = validTypes.some((t) => MAIL_DOC_TYPES.has(t))
    if (hasMail && plan === 'starter') {
      return NextResponse.json(
        { error: 'plan_required', message: "Les mails (remerciement, marketing) sont réservés aux plans payants. Passe sur Solo ou plus pour les générer." },
        { status: 403 },
      )
    }

    // Vérif crédits AVANT toute action (scène image + appels IA).
    const cost = validTypes.length * PER_DOC_COST
    const credits = await getCredits(userId)
    if (credits < cost) {
      return NextResponse.json(
        { error: 'insufficient_credits', message: `Il vous reste ${credits} crédits. Cette génération en coûte ${cost} (${validTypes.length} × ${PER_DOC_COST}).`, credits, required: cost },
        { status: 402 },
      )
    }

    // Persiste le dealText sur l'opération si fourni avec un forfait sélectionné.
    if (operation && validTypes.includes('forfait') && typeof dealText === 'string' && dealText.trim()) {
      await supabaseAdmin.from('operations').update({ deal_text: dealText.trim() }).eq('id', operation.id)
      operation = { ...operation, deal_text: dealText.trim() }
    }

    // Scène image : nécessaire pour tous les types SAUF nouveaute. Cachée sur l'opération.
    // forceSceneRefresh=true ignore le cache et regénère une image fraîche
    // (utile si la consigne d'opération a été retravaillée après un 1er rendu décevant).
    const needsScene = validTypes.some((t) => !NOUVEAUTE_TYPES.has(t))
    let sceneUrl: string | null = forceSceneRefresh ? null : (operation?.background_image_url || null)
    if (needsScene && operation && !sceneUrl) {
      const refs: string[] = Array.isArray(operation.images) ? operation.images.filter(Boolean) : []
      if (refs.length === 0) {
        return NextResponse.json(
          { error: 'missing_product_image', message: "Ajoute au moins une photo du produit/service à l'opération avant de générer (gpt-image-1 a besoin d'une référence visuelle)." },
          { status: 400 },
        )
      }
      sceneUrl = await generateSceneImage(buildScenePrompt(contact, operation), refs, userId, operation.id)
      await supabaseAdmin
        .from('operations')
        .update({ background_image_url: sceneUrl })
        .eq('id', operation.id)
    }

    // Image produit originale pour la fiche Nouveauté (pas d'IA, on prend la 1re upload).
    const productImageUrl: string | null = Array.isArray(operation?.images) && operation.images.length > 0
      ? operation.images[0]
      : null
    if (validTypes.includes('nouveaute') && !productImageUrl) {
      return NextResponse.json(
        { error: 'missing_product_image', message: "La fiche Nouveauté requiert au moins une photo du produit dans l'opération." },
        { status: 400 },
      )
    }

    const prompts = buildDocPrompts(contact, profile, operation, { dealText: dealText || operation?.deal_text || null })
    const results: Record<string, string> = {}

    for (const docType of validTypes) {
      const prompt = prompts[docType]
      if (!prompt) continue
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
      const content = message.content[0]
      if (content.type !== 'text') continue

      const bodyHtml = sanitizeBody(content.text)
      const fullHtml = buildHtml({ brand: contact, profile, docType, sceneUrl, bodyHtml, productImageUrl })
      results[docType] = fullHtml

      await supabaseAdmin.from('documents').upsert(
        {
          contact_id: contactId,
          operation_id: operationId ?? null,
          user_id: contact.user_id,
          type: docType,
          content: fullHtml,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'contact_id,operation_id,type' },
      )
    }

    const deduction = await deductCredits(userId, cost)

    return NextResponse.json({ success: true, documents: results, credits: deduction.remaining, sceneUrl, cost, generated: validTypes })
  } catch (error) {
    console.error('Generate error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Erreur génération', detail: message }, { status: 500 })
  }
}
