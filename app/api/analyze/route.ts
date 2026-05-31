import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PLANS, PlanId } from '@/lib/plans'
import { getCredits, deductCredits } from '@/lib/credits'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(req: Request) {
  const { url, contactId } = await req.json()

  if (!url || !contactId) {
    return NextResponse.json({ error: 'URL et contactId requis' }, { status: 400 })
  }

  // Récupère le contact pour identifier le propriétaire (et donc son plan).
  const { data: contactRow, error: contactErr } = await supabaseAdmin
    .from('contacts')
    .select('user_id')
    .eq('id', contactId)
    .maybeSingle()
  if (contactErr) {
    return NextResponse.json({ error: 'Erreur lecture contact', detail: contactErr.message }, { status: 500 })
  }
  if (!contactRow) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
  }
  const userId: string = contactRow.user_id

  // Plan + suivi du scraping gratuit (1 seul à vie, tout plan confondu).
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, free_scrape_used')
    .eq('user_id', userId)
    .maybeSingle()
  const plan: PlanId = (profile?.plan && profile.plan in PLANS) ? (profile.plan as PlanId) : 'starter'
  const freeUsed = !!profile?.free_scrape_used
  const scrapeCost = PLANS[plan].scrapeCost

  // Si le scraping gratuit a déjà été utilisé ET que le plan facture l'analyse,
  // on vérifie le solde de crédits AVANT toute requête réseau / IA.
  if (freeUsed && scrapeCost > 0) {
    const balance = await getCredits(userId)
    if (balance < scrapeCost) {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: `Il vous reste ${balance} crédits. Une analyse coûte ${scrapeCost} crédits sur le plan ${PLANS[plan].label}.`,
          credits: balance,
          required: scrapeCost,
        },
        { status: 402 },
      )
    }
  }

  // Normalise l'URL : ajoute https:// si l'utilisateur n'a pas mis de protocole
  let targetUrl = url.trim()
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl

  try {
    let html: string
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Site inaccessible', detail: `HTTP ${response.status} sur ${targetUrl}` },
          { status: 502 },
        )
      }
      html = await response.text()
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      return NextResponse.json(
        { error: 'Échec du scraping', detail: `Impossible de lire ${targetUrl} — ${msg}` },
        { status: 502 },
      )
    }

    if (!html || html.length < 100) {
      return NextResponse.json(
        { error: 'Page vide', detail: `Le site ${targetUrl} a renvoyé ${html?.length ?? 0} caractères` },
        { status: 502 },
      )
    }

    const truncated = html.slice(0, 12000)

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Tu es un expert en branding et identité visuelle. Analyse ce HTML et extrait le branding RÉEL de l'entreprise.

RÈGLES IMPORTANTES :
- Ignore absolument les couleurs génériques de frameworks : #0D6EFF #007bff #0066cc #6c757d #212529 (Bootstrap/Odoo/Shopify/WordPress)
- Concentre-toi UNIQUEMENT sur les couleurs personnalisées et uniques à cette marque
- Pour les fonts : cherche @font-face, Google Fonts imports, font-family dans les styles inline et balises link
- Si tu ne trouves pas de vraies couleurs de marque, retourne des tons neutres cohérents avec le secteur
- Le ton doit refléter le contenu textuel et l'ambiance générale du site

HTML :
${truncated}

Réponds UNIQUEMENT en JSON valide, sans backticks, sans texte avant ou après :
{
  "brand_colors": ["#hex1", "#hex2", "#hex3"],
  "brand_fonts": ["Font1", "Font2"],
  "brand_tone": "un seul mot parmi: professionnel / créatif / luxe / casual / technique / bienveillant / dynamique",
  "brand_sector": "secteur en 2-3 mots",
  "brand_name": "nom de la marque",
  "brand_email": "email ou null",
  "brand_phone": "téléphone ou null",
  "brand_address": "adresse ou null",
  "brand_description": "description en 1-2 phrases",
  "brand_values": ["valeur1", "valeur2", "valeur3"]
}`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 })
    }

    const clean = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let brand
    try {
      brand = JSON.parse(clean)
    } catch {
      return NextResponse.json(
        { error: 'Réponse IA non JSON', detail: clean.slice(0, 500) },
        { status: 500 },
      )
    }

    await supabaseAdmin.from('contacts').update({
      brand_colors: brand.brand_colors,
      brand_fonts: brand.brand_fonts,
      brand_tone: brand.brand_tone,
      brand_sector: brand.brand_sector,
      brand_name: brand.brand_name,
      brand_email: brand.brand_email,
      brand_phone: brand.brand_phone,
      brand_address: brand.brand_address,
      brand_description: brand.brand_description,
      brand_values: brand.brand_values
    }).eq('id', contactId)

    // Facturation post-analyse : 1ère analyse gratuite à vie, puis débit
    // selon le plan (5 crédits sur tous les plans). Le scraping gratuit est
    // unique à vie — un abonnement ne le réinitialise pas.
    let remainingCredits: number | null = null
    if (!freeUsed) {
      await supabaseAdmin
        .from('profiles')
        .upsert({ user_id: userId, free_scrape_used: true }, { onConflict: 'user_id' })
    } else if (scrapeCost > 0) {
      const deduction = await deductCredits(userId, scrapeCost)
      remainingCredits = deduction.remaining
    }

    return NextResponse.json({
      ...brand,
      free_scrape_used: true,
      scrape_cost: freeUsed ? scrapeCost : 0,
      credits: remainingCredits,
    })

  } catch (error) {
    console.error('Analyze error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Erreur analyse', detail: message }, { status: 500 })
  }
}