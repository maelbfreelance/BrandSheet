import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(req: Request) {
  const { url, contactId } = await req.json()

  if (!url || !contactId) {
    return NextResponse.json({ error: 'URL et contactId requis' }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const html = await response.text()
    const truncated = html.slice(0, 12000)

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Tu es un expert en branding et design. Analyse ce code HTML d'un site web professionnel et extrait TOUTES les informations de branding disponibles.

HTML :
${truncated}

Réponds UNIQUEMENT en JSON valide, sans backticks, sans texte avant ou après, avec exactement cette structure :
{
  "brand_colors": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "brand_fonts": ["Font1", "Font2"],
  "brand_tone": "un seul mot parmi: professionnel / créatif / luxe / casual / technique / bienveillant / dynamique",
  "brand_sector": "secteur d'activité en 2-3 mots",
  "brand_name": "nom de la marque ou entreprise",
  "brand_email": "email de contact si trouvé sinon null",
  "brand_phone": "téléphone si trouvé sinon null",
  "brand_address": "adresse physique si trouvée sinon null",
  "brand_description": "description de l'entreprise en 1-2 phrases",
  "brand_values": ["valeur1", "valeur2", "valeur3"]
}

Pour les couleurs : cherche dans les styles CSS inline, les classes Tailwind, les variables CSS. Retourne des codes HEX valides uniquement.
Pour les fonts : cherche dans les imports Google Fonts, les font-family CSS.`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 })
    }

    const clean = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const brand = JSON.parse(clean)

    await supabase.from('contacts').update({
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

    return NextResponse.json(brand)

  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}