import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const docPrompts: Record<string, (brand: any, order: any) => string> = {
  bienvenue: (brand, order) => `Tu es un expert en communication professionnelle. Rédige un mail de bienvenue pour un nouveau client.

Informations de la marque :
- Nom : ${brand.brand_name || brand.name}
- Secteur : ${brand.brand_sector}
- Ton éditorial : ${brand.brand_tone}
- Description : ${brand.brand_description || ''}
- Valeurs : ${brand.brand_values?.join(', ') || ''}

Commande/contexte : ${order || 'Nouveau client'}

Rédige un mail de bienvenue chaleureux, professionnel, dans le ton de la marque. 
Format : Objet du mail sur la première ligne, puis le corps du mail.
Longueur : 150-200 mots maximum.`,

  remerciement: (brand, order) => `Tu es un expert en communication professionnelle. Rédige un mail de remerciement post-prestation.

Informations de la marque :
- Nom : ${brand.brand_name || brand.name}
- Secteur : ${brand.brand_sector}
- Ton éditorial : ${brand.brand_tone}
- Description : ${brand.brand_description || ''}

Commande/contexte : ${order || 'Prestation terminée'}

Rédige un mail de remerciement sincère et professionnel dans le ton de la marque.
Format : Objet du mail sur la première ligne, puis le corps du mail.
Longueur : 100-150 mots maximum.`,

  avis: (brand, order) => `Tu es un expert en communication professionnelle. Rédige un mail de demande d'avis/témoignage.

Informations de la marque :
- Nom : ${brand.brand_name || brand.name}
- Secteur : ${brand.brand_sector}
- Ton éditorial : ${brand.brand_tone}

Commande/contexte : ${order || 'Demande d\'avis'}

Rédige un mail poli et engageant pour demander un avis client.
Format : Objet du mail sur la première ligne, puis le corps du mail.
Longueur : 100-130 mots maximum.`,

  facture: (brand, order) => `Tu es un expert en gestion administrative. Génère le contenu d'une facture professionnelle.

Informations de la marque :
- Nom : ${brand.brand_name || brand.name}
- Secteur : ${brand.brand_sector}
- Email : ${brand.brand_email || ''}
- Téléphone : ${brand.brand_phone || ''}
- Adresse : ${brand.brand_address || ''}
- Ton éditorial : ${brand.brand_tone}

Commande/contexte : ${order || 'Prestation de services'}

Génère une facture complète avec :
- Numéro de facture (FAC-2025-001)
- Date
- Désignation des prestations
- Montants HT/TVA/TTC
- Conditions de paiement
- Mentions légales adaptées au secteur

Format clair et structuré.`,

  devis: (brand, order) => `Tu es un expert en gestion administrative. Génère le contenu d'un devis professionnel.

Informations de la marque :
- Nom : ${brand.brand_name || brand.name}
- Secteur : ${brand.brand_sector}
- Email : ${brand.brand_email || ''}
- Téléphone : ${brand.brand_phone || ''}
- Adresse : ${brand.brand_address || ''}
- Ton éditorial : ${brand.brand_tone}

Commande/contexte : ${order || 'Prestation de services'}

Génère un devis complet avec :
- Numéro de devis (DEV-2025-001)
- Date et durée de validité (30 jours)
- Désignation détaillée des prestations
- Montants HT/TVA/TTC
- Conditions générales
- Zone de signature

Format clair et structuré.`,

  cgv: (brand, order) => `Tu es un expert juridique. Génère des Conditions Générales de Vente adaptées.

Informations de la marque :
- Nom : ${brand.brand_name || brand.name}
- Secteur : ${brand.brand_sector}
- Email : ${brand.brand_email || ''}
- Adresse : ${brand.brand_address || ''}

Activité : ${order || brand.brand_sector}

Génère des CGV complètes et conformes au droit français incluant :
- Objet et champ d'application
- Prix et modalités de paiement
- Conditions de livraison/réalisation
- Droit de rétractation
- Responsabilités
- Protection des données (RGPD)
- Litiges et juridiction compétente

DISCLAIMER : Ces CGV sont générées à titre indicatif et doivent être validées par un professionnel juridique.`
}

export async function POST(req: Request) {
  const { contactId, orderInfo } = await req.json()

  if (!contactId) {
    return NextResponse.json({ error: 'contactId requis' }, { status: 400 })
  }

  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    const results: Record<string, string> = {}
    const docTypes = Object.keys(docPrompts)

    for (const docType of docTypes) {
      const prompt = docPrompts[docType](contact, orderInfo)
      
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
        }, {
          onConflict: 'contact_id,type'
        })
      }
    }

    return NextResponse.json({ success: true, documents: results })

  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })
  }
}