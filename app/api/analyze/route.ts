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
    const truncated = html.slice(0, 8000)

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyse ce code HTML d'un site web et extrait les informations de branding.

HTML :
${truncated}

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, avec exactement cette structure :
{
  "brand_colors": ["#hex1", "#hex2", "#hex3"],
  "brand_fonts": ["Font1", "Font2"],
  "brand_tone": "professionnel / créatif / luxe / casual / technique",
  "brand_sector": "secteur d'activité en 2-3 mots"
}`
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
      brand_sector: brand.brand_sector
    }).eq('id', contactId)

    return NextResponse.json(brand)

  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}