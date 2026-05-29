// v2
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { GENERATION_COST, getCredits, deductCredits } from '@/lib/credits'

export async function POST(req: Request) {
  const { contactId, orderInfo } = await req.json()

  if (!contactId) {
    return NextResponse.json({ error: 'contactId requis' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    const userId = contact.user_id
    const credits = await getCredits(userId)
    if (credits < GENERATION_COST) {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: `Il vous reste ${credits} crédits. Cette génération en coûte ${GENERATION_COST}.`,
          credits,
          required: GENERATION_COST,
        },
        { status: 402 },
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    const b = contact
    const o = orderInfo || 'Prestation de services'
    const brandInfo = `Marque: ${b.brand_name || b.name} | Secteur: ${b.brand_sector} | Ton: ${b.brand_tone} | Email: ${b.brand_email || ''} | Tel: ${b.brand_phone || ''} | Adresse: ${b.brand_address || ''} | Description: ${b.brand_description || ''} | Valeurs: ${b.brand_values?.join(', ') || ''}`

    const issuerInfo = profile
      ? `Émetteur (à utiliser pour les mentions légales / coordonnées du prestataire) : ${[
          profile.full_name && `Nom: ${profile.full_name}`,
          profile.company_name && `Raison sociale: ${profile.company_name}`,
          profile.siret && `SIRET: ${profile.siret}`,
          profile.address && `Adresse: ${profile.address}`,
          (profile.postal_code || profile.city) && `${profile.postal_code || ''} ${profile.city || ''}`.trim(),
          profile.country && `Pays: ${profile.country}`,
          profile.email_pro && `Email: ${profile.email_pro}`,
          profile.phone && `Tel: ${profile.phone}`,
        ]
          .filter(Boolean)
          .join(' | ')}`
      : ''

    const docPrompts: Record<string, string> = {
      bienvenue: `Rédige un mail de bienvenue pour un nouveau client. ${brandInfo}. ${issuerInfo} Contexte: ${o}. Format: Objet sur la 1ère ligne puis corps du mail. 150 mots max. Ton ${b.brand_tone}.`,
      remerciement: `Rédige un mail de remerciement post-prestation. ${brandInfo}. ${issuerInfo} Contexte: ${o}. Format: Objet sur la 1ère ligne puis corps. 120 mots max. Ton ${b.brand_tone}.`,
      avis: `Rédige un mail de demande d'avis client. ${brandInfo}. ${issuerInfo} Contexte: ${o}. Format: Objet sur la 1ère ligne puis corps. 100 mots max. Ton ${b.brand_tone}.`,
      facture: `Génère le contenu d'une facture professionnelle. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Inclure: numéro FAC-2025-001, date, désignation, montants HT/TVA/TTC, conditions de paiement, mentions légales avec les coordonnées de l'émetteur.`,
      devis: `Génère un devis professionnel. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Inclure: numéro DEV-2025-001, date, validité 30j, désignation détaillée, montants HT/TVA/TTC, zone de signature, coordonnées de l'émetteur.`,
      cgv: `Génère des CGV conformes au droit français. ${brandInfo}. ${issuerInfo} Activité: ${b.brand_sector}. Inclure: objet, prix/paiement, livraison, rétractation, responsabilités, RGPD, litiges, identification du prestataire. DISCLAIMER: à valider par un professionnel juridique.`,
    }

    const results: Record<string, string> = {}

    for (const [docType, prompt] of Object.entries(docPrompts)) {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })

      const content = message.content[0]
      if (content.type === 'text') {
        results[docType] = content.text
        await supabase.from('documents').upsert({
          contact_id: contactId,
          user_id: contact.user_id,
          type: docType,
          content: content.text,
          created_at: new Date().toISOString()
        }, { onConflict: 'contact_id,type' })
      }
    }

    const deduction = await deductCredits(userId, GENERATION_COST)

    return NextResponse.json({
      success: true,
      documents: results,
      credits: deduction.remaining,
    })

  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })
  }
}
