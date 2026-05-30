// Génération à la carte : l'utilisateur sélectionne 1 ou plusieurs types de
// documents, on facture PER_DOC_COST crédits par document généré. Les types
// 'mail_*' nécessitent un plan payant. La scène image (gpt-image-1) n'est
// générée que si au moins un doc en a besoin (toutes les fiches sauf
// 'nouveaute' qui utilise l'image originale uploadée).
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PER_DOC_COST, getCredits, deductCredits } from '@/lib/credits'
import { PLANS, type PlanId } from '@/lib/plans'
import {
  ACTIVE_DOC_TYPES,
  MAIL_DOC_TYPES,
  buildDocPrompts,
  buildHtml,
  buildScenePrompt,
  generateSceneImage,
  sanitizeBody,
  type SceneQuality,
} from '@/lib/doc-render'

const NOUVEAUTE_TYPES = new Set(['nouveaute'])
/** Qualité 'high' : facturée 8 crédits / doc au lieu de 4 (tarif identique
 *  pour tous les plans), et réservée aux plans payants (cf. /pricing). */
const HIGH_QUALITY_COST = 8

export async function POST(req: Request) {
  const { contactId, operationId, types, dealText, forceSceneRefresh, quality: rawQuality } = await req.json()
  const quality: SceneQuality = rawQuality === 'high' ? 'high' : 'medium'

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
    const accountType: 'freelance' | 'brand' = profile?.account_type === 'brand' ? 'brand' : 'freelance'

    // Gating mails : plan payant requis.
    const hasMail = validTypes.some((t) => MAIL_DOC_TYPES.has(t))
    if (hasMail && plan === 'starter') {
      return NextResponse.json(
        { error: 'plan_required', message: "Les mails (remerciement, marketing) sont réservés aux plans payants. Passe sur Solo ou plus pour les générer." },
        { status: 403 },
      )
    }

    // Gating qualité 'high' : réservée aux plans payants. Le Starter reçoit
    // un message explicite + lien /pricing pour upgrader.
    if (quality === 'high' && plan === 'starter') {
      return NextResponse.json(
        { error: 'plan_required', message: "La qualité premium est réservée aux plans payants. Passe sur Solo pour activer la qualité premium." },
        { status: 403 },
      )
    }

    // Vérif crédits AVANT toute action (scène image + appels IA).
    // Tarification : 4 crédits / doc en standard, 8 crédits / doc en premium.
    const perDoc = quality === 'high' ? HIGH_QUALITY_COST : PER_DOC_COST
    const cost = validTypes.length * perDoc
    const credits = await getCredits(userId)
    if (credits < cost) {
      return NextResponse.json(
        { error: 'insufficient_credits', message: `Il vous reste ${credits} crédits. Cette génération en coûte ${cost} (${validTypes.length} × ${perDoc}).`, credits, required: cost },
        { status: 402 },
      )
    }

    // Persiste le dealText sur l'opération si fourni avec un forfait sélectionné.
    if (operation && validTypes.includes('forfait') && typeof dealText === 'string' && dealText.trim()) {
      await supabaseAdmin.from('operations').update({ deal_text: dealText.trim() }).eq('id', operation.id)
      operation = { ...operation, deal_text: dealText.trim() }
    }

    // Scène image : nécessaire pour tous les types SAUF nouveaute. Cachée sur l'opération.
    // - forceSceneRefresh=true → ignore le cache
    // - cached_quality='medium' mais requested='high' → on regénère (montée en gamme)
    // - cached_quality='high' et requested='medium' → on réutilise (downgrade inoffensif)
    const needsScene = validTypes.some((t) => !NOUVEAUTE_TYPES.has(t))
    const cachedQuality: SceneQuality = operation?.background_image_quality === 'high' ? 'high' : 'medium'
    const qualityUpgrade = quality === 'high' && cachedQuality !== 'high'
    let sceneUrl: string | null = (forceSceneRefresh || qualityUpgrade) ? null : (operation?.background_image_url || null)
    if (needsScene && operation && !sceneUrl) {
      const refs: string[] = Array.isArray(operation.images) ? operation.images.filter(Boolean) : []
      if (refs.length === 0) {
        return NextResponse.json(
          { error: 'missing_product_image', message: "Ajoute au moins une photo du produit/service à l'opération avant de générer (gpt-image-1 a besoin d'une référence visuelle)." },
          { status: 400 },
        )
      }
      sceneUrl = await generateSceneImage(buildScenePrompt(contact, operation, accountType), refs, userId, operation.id, quality)
      await supabaseAdmin
        .from('operations')
        .update({ background_image_url: sceneUrl, background_image_quality: quality })
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

    const prompts = buildDocPrompts(contact, profile, operation, { dealText: dealText || operation?.deal_text || null, accountType })
    const results: Record<string, string> = {}

    // Qualité 'high' : on monte d'un cran le modèle (Sonnet 4.6 au lieu de Haiku
    // 4.5) ET on injecte une consigne de soin maximal, pour que la prime payée
    // par l'utilisateur produise réellement un texte plus travaillé.
    const textModel = quality === 'high' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
    const precisionSuffix = quality === 'high'
      ? `\n\nQUALITÉ PREMIUM — CONSIGNE DE SOIN MAXIMAL : ce document est facturé en qualité premium. Avant d'envoyer ta réponse, RELIS-LA mentalement lettre par lettre. Pèse chaque mot, vérifie chaque virgule, chaque accord, chaque accent. Aucune faute d'orthographe, aucune coquille, aucune répétition de mot. Le rythme des phrases doit être travaillé (varie les longueurs, évite les enchaînements plats). Les tournures doivent être nettes, précises, élégantes — au niveau d'un copywriter senior, pas d'un brouillon. Aucun cliché ("n'hésitez pas à...", "dans le cadre de...", "au plaisir de..." sauf si parfaitement justifié). Concentre-toi VRAIMENT sur la qualité de chaque phrase.`
      : ''

    for (const docType of validTypes) {
      const prompt = prompts[docType]
      if (!prompt) continue
      const message = await anthropic.messages.create({
        model: textModel,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt + precisionSuffix }],
      })
      const content = message.content[0]
      if (content.type !== 'text') continue

      const bodyHtml = sanitizeBody(content.text)
      const fullHtml = buildHtml({ brand: contact, profile, docType, sceneUrl, bodyHtml, productImageUrl, accountType })
      results[docType] = fullHtml

      await supabaseAdmin.from('documents').insert({
        contact_id: contactId,
        operation_id: operationId ?? null,
        user_id: contact.user_id,
        type: docType,
        content: fullHtml,
        created_at: new Date().toISOString(),
      })
    }

    // FIFO : purge des plus vieux documents du contact dépassant la limite du
    // plan. retention.kind === 'count' uniquement (les autres plans = unlimited).
    let purgedCount = 0
    const planInfo = PLANS[plan as PlanId] ?? PLANS.starter
    if (planInfo.retention.kind === 'count') {
      const limit = planInfo.retention.value
      const { data: allDocs } = await supabaseAdmin
        .from('documents')
        .select('id, created_at')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
      if (allDocs && allDocs.length > limit) {
        const toDelete = allDocs.slice(limit).map((d) => d.id)
        await supabaseAdmin.from('documents').delete().in('id', toDelete)
        purgedCount = toDelete.length
      }
    }

    const deduction = await deductCredits(userId, cost)

    return NextResponse.json({ success: true, documents: results, credits: deduction.remaining, sceneUrl, cost, generated: validTypes, purged: purgedCount })
  } catch (error) {
    console.error('Generate error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Erreur génération', detail: message }, { status: 500 })
  }
}
