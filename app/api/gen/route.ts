// v5 — HTML output + single scene image (product staged) with text overlay
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { GENERATION_COST, getCredits, deductCredits } from '@/lib/credits'
import {
  buildDocPrompts,
  buildHtml,
  buildScenePrompt,
  generateSceneImage,
  sanitizeBody,
} from '@/lib/doc-render'

export async function POST(req: Request) {
  const { contactId, operationId } = await req.json()

  if (!contactId) {
    return NextResponse.json({ error: 'contactId requis' }, { status: 400 })
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
    const credits = await getCredits(userId)
    if (credits < GENERATION_COST) {
      return NextResponse.json(
        { error: 'insufficient_credits', message: `Il vous reste ${credits} crédits. Cette génération en coûte ${GENERATION_COST}.`, credits, required: GENERATION_COST },
        { status: 402 },
      )
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('user_id', userId).maybeSingle()

    // Une seule image scène par opération, mise en cache et réutilisée sur les 6 docs.
    // Image obligatoire : si la génération échoue, on annule AVANT le débit de crédits.
    let sceneUrl: string | null = operation?.background_image_url || null
    if (operation && !sceneUrl) {
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

    const prompts = buildDocPrompts(contact, profile, operation)
    const results: Record<string, string> = {}

    for (const [docType, prompt] of Object.entries(prompts)) {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
      const content = message.content[0]
      if (content.type !== 'text') continue

      const bodyHtml = sanitizeBody(content.text)
      const fullHtml = buildHtml({ brand: contact, profile, docType, sceneUrl, bodyHtml })
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

    const deduction = await deductCredits(userId, GENERATION_COST)

    return NextResponse.json({ success: true, documents: results, credits: deduction.remaining, sceneUrl })
  } catch (error) {
    console.error('Generate error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Erreur génération', detail: message }, { status: 500 })
  }
}
