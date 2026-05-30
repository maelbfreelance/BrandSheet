// Construit une version Gmail-friendly du mail (inline styles + <img> pour la
// scène) pour que l'utilisateur puisse la coller dans le compose Gmail avec
// l'image et les couleurs préservées. Les paramètres URL de Gmail compose
// n'acceptent que du texte brut — la seule voie pour le rich content est le
// clipboard + paste.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildMailClipboardHtml, MAIL_DOC_TYPES } from '@/lib/doc-render'

export async function POST(req: Request) {
  const { docId } = await req.json()
  if (!docId) return NextResponse.json({ error: 'docId requis' }, { status: 400 })

  const { data: doc } = await supabaseAdmin.from('documents').select('*').eq('id', docId).maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (!MAIL_DOC_TYPES.has(doc.type)) {
    return NextResponse.json({ error: 'Ce document n\'est pas un mail' }, { status: 400 })
  }

  const { data: contact } = await supabaseAdmin.from('contacts').select('*').eq('id', doc.contact_id).maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('user_id', contact.user_id).maybeSingle()
  const accountType: 'freelance' | 'brand' = profile?.account_type === 'brand' ? 'brand' : 'freelance'

  // Extrait le bodyHtml et le sceneUrl depuis doc.content (HTML complet). On lit
  // les valeurs RÉELLES affichées (l'utilisateur a pu éditer le doc), pas un
  // rebuild from scratch.
  const fullHtml: string = doc.content || ''
  const sceneUrl = extractSceneUrl(fullHtml)
  const bodyHtml = extractBody(fullHtml) || ''

  const built = buildMailClipboardHtml({
    brand: contact,
    profile,
    docType: doc.type,
    sceneUrl,
    bodyHtml,
    accountType,
  })

  const to = contact.brand_email || contact.email || ''
  return NextResponse.json({ ...built, to })
}

function extractSceneUrl(html: string): string | null {
  const m = html.match(/\.doc-scene\s*\{[^}]*background\s*:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i)
  if (m) return m[1]
  const m2 = html.match(/\.doc-hero-bg\s*\{[^}]*background\s*:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i)
  return m2 ? m2[1] : null
}

// Extrait le contenu entre <div class="doc-body" ...> et son </div> appairé.
// Implémentation balance-aware : le body peut contenir <div class="doc-stars">.
function extractBody(html: string): string | null {
  const start = html.match(/<div[^>]*class="doc-body"[^>]*>/i)
  if (!start || start.index === undefined) return null
  const openIdx = start.index + start[0].length
  let depth = 1
  let i = openIdx
  while (i < html.length) {
    const nextOpen = html.toLowerCase().indexOf('<div', i)
    const nextClose = html.toLowerCase().indexOf('</div>', i)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      if (depth === 0) return html.slice(openIdx, nextClose)
      i = nextClose + 6
    }
  }
  return null
}
