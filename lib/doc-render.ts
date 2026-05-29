import { supabaseAdmin } from './supabase-admin'
import { getOpenAI } from './openai'

export const DOC_TYPE_LABELS: Record<string, string> = {
  bienvenue: 'Mail de bienvenue',
  remerciement: 'Mail de remerciement',
  avis: 'Demande d\'avis',
  facture: 'Facture',
  devis: 'Devis',
  cgv: 'Conditions Générales de Vente',
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export function buildHtml(opts: {
  brand: any
  profile: any
  docType: string
  heroUrl: string | null
  bodyHtml: string
  refImages?: string[]
}): string {
  const { brand, profile, docType, heroUrl, bodyHtml, refImages = [] } = opts
  const colors = Array.isArray(brand.brand_colors) ? brand.brand_colors : []
  const c1 = colors[0] || '#4F8EF7'
  const c2 = colors[1] || '#7C3AED'
  const c3 = colors[2] || '#0F1E3A'
  const fonts = Array.isArray(brand.brand_fonts) ? brand.brand_fonts.filter(Boolean) : []
  const headingFont = fonts[0] ? `'${fonts[0]}', Georgia, serif` : `Georgia, serif`
  const bodyFont = fonts[1] || fonts[0] ? `'${fonts[1] || fonts[0]}', system-ui, sans-serif` : `system-ui, sans-serif`
  const brandName = brand.brand_name || brand.name || 'Marque'
  const footerBits = profile
    ? [profile.company_name, profile.siret && `SIRET ${profile.siret}`, profile.email_pro, profile.phone].filter(Boolean).join(' · ')
    : ''

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(brandName)} — ${escapeHtml(DOC_TYPE_LABELS[docType] || docType)}</title>
<style>
:root{--c1:${c1};--c2:${c2};--c3:${c3};--heading:${headingFont};--body:${bodyFont};}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:var(--body);color:#1a1a1a;background:#f4f4f7;line-height:1.6;padding:24px;}
.doc{max-width:780px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,0.06);}
.doc-strip{height:6px;background:linear-gradient(90deg,var(--c1),var(--c2),var(--c3));}
.doc-hero{display:block;width:100%;height:240px;object-fit:cover;}
.doc-header{padding:32px 40px 24px;border-bottom:2px solid var(--c1);}
.doc-brand{font-family:var(--heading);font-size:30px;font-weight:700;color:var(--c1);margin-top:8px;}
.doc-sub{font-size:12px;color:#666;margin-top:6px;text-transform:uppercase;letter-spacing:1.5px;}
.doc-body{padding:32px 40px;}
.doc-body h1,.doc-body h2,.doc-body h3{font-family:var(--heading);color:var(--c2);margin:20px 0 12px;}
.doc-body h2{font-size:22px;border-left:4px solid var(--c1);padding-left:12px;}
.doc-body h3{font-size:18px;color:var(--c1);}
.doc-body p{margin-bottom:14px;}
.doc-body strong{color:var(--c2);font-weight:600;}
.doc-body ul,.doc-body ol{padding-left:22px;margin-bottom:14px;}
.doc-body li{margin-bottom:6px;}
.doc-body table{width:100%;border-collapse:collapse;margin:16px 0;}
.doc-body th,.doc-body td{padding:10px 12px;border-bottom:1px solid #eee;text-align:left;}
.doc-body th{background:var(--c1);color:#fff;font-family:var(--heading);font-weight:600;}
.doc-refs{padding:0 40px 24px;display:flex;gap:10px;flex-wrap:wrap;}
.doc-refs img{width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #eee;}
.doc-footer{padding:18px 40px 28px;font-size:11px;color:#888;background:#fafafa;border-top:1px solid #eee;}
[contenteditable="true"]{outline:2px dashed rgba(79,142,247,.4);outline-offset:4px;border-radius:4px;}
@media print{body{background:#fff;padding:0;}.doc{box-shadow:none;border-radius:0;}}
</style></head>
<body>
<div class="doc" data-brandsheet="${escapeHtml(docType)}">
  <div class="doc-strip"></div>
  ${heroUrl ? `<img class="doc-hero" src="${escapeHtml(heroUrl)}" alt=""/>` : ''}
  <div class="doc-header">
    <div class="doc-brand">${escapeHtml(brandName)}</div>
    <div class="doc-sub">${escapeHtml(DOC_TYPE_LABELS[docType] || docType)}</div>
  </div>
  <div class="doc-body" data-editable="true">${bodyHtml}</div>
  ${refImages.length ? `<div class="doc-refs">${refImages.map((u) => `<img src="${escapeHtml(u)}" alt=""/>`).join('')}</div>` : ''}
  ${footerBits ? `<div class="doc-footer">${escapeHtml(footerBits)}</div>` : ''}
</div>
<script>
(function(){
  var b = document.querySelector('[data-editable="true"]');
  window.brandsheetSetEdit = function(on){
    if (!b) return;
    b.contentEditable = on ? 'true' : 'false';
    if (on) b.focus();
  };
  window.brandsheetGetHTML = function(){
    return '<!doctype html>' + document.documentElement.outerHTML;
  };
})();
</script>
</body></html>`
}

export async function generateHeroImage(prompt: string, userId: string, opId: string): Promise<string> {
  const openai = getOpenAI()
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1536x1024',
    quality: 'medium',
    n: 1,
  })
  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('Aucune image renvoyée par gpt-image-1')
  const buffer = Buffer.from(b64, 'base64')
  const path = `${userId}/${opId}/hero-${Date.now()}.png`
  const { error: upErr } = await supabaseAdmin.storage.from('operations').upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  })
  if (upErr) throw upErr
  const { data: pub } = supabaseAdmin.storage.from('operations').getPublicUrl(path)
  return pub.publicUrl
}

export function buildHeroPrompt(brand: any, operation: any): string {
  const palette = (brand.brand_colors || []).slice(0, 3).join(', ') || 'tons neutres'
  return `Visuel hero éditorial pour un document de marque. Marque : ${brand.brand_name || brand.name}. Secteur : ${brand.brand_sector || 'générique'}. Ton : ${brand.brand_tone || 'professionnel'}. Palette dominante : ${palette}. ${operation?.description ? `Contexte produit : ${operation.description}.` : ''} Composition épurée, esthétique premium, mise en valeur subtile, sans texte, format paysage, ambiance ${brand.brand_tone || 'professionnelle'}.`
}

export function buildDocPrompts(brand: any, profile: any, operation: any): Record<string, string> {
  const b = brand
  const o = operation
    ? [operation.name && `Opération: ${operation.name}`, operation.description && `Contexte: ${operation.description}`].filter(Boolean).join(' | ')
    : 'Prestation de services'

  const brandInfo = `Marque: ${b.brand_name || b.name} | Secteur: ${b.brand_sector} | Ton: ${b.brand_tone} | Description: ${b.brand_description || ''} | Valeurs: ${b.brand_values?.join(', ') || ''}`
  const issuerInfo = profile
    ? `Émetteur : ${[profile.full_name && `Nom: ${profile.full_name}`, profile.company_name && `Raison sociale: ${profile.company_name}`, profile.siret && `SIRET: ${profile.siret}`, profile.address && `Adresse: ${profile.address}`, (profile.postal_code || profile.city) && `${profile.postal_code || ''} ${profile.city || ''}`.trim(), profile.email_pro && `Email: ${profile.email_pro}`, profile.phone && `Tel: ${profile.phone}`].filter(Boolean).join(' | ')}`
    : ''

  const htmlContract = `IMPORTANT: Output UNIQUEMENT du HTML brut, sans <html>, sans <body>, sans <style>, sans backticks, sans markdown. Balises autorisées: <h2>, <h3>, <p>, <strong>, <ul>, <ol>, <li>, <br>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. Le texte doit être prêt à être affiché dans un document brandé.`

  return {
    bienvenue: `Rédige le CORPS HTML d'un mail de bienvenue pour un nouveau client. Commence par <h2>Objet : ...</h2> puis le corps en <p>. ${brandInfo}. ${issuerInfo} Contexte: ${o}. 150 mots max. Ton ${b.brand_tone}. ${htmlContract}`,
    remerciement: `Rédige le CORPS HTML d'un mail de remerciement post-prestation. Commence par <h2>Objet : ...</h2>. ${brandInfo}. ${issuerInfo} Contexte: ${o}. 120 mots max. Ton ${b.brand_tone}. ${htmlContract}`,
    avis: `Rédige le CORPS HTML d'un mail de demande d'avis client. Commence par <h2>Objet : ...</h2>. ${brandInfo}. ${issuerInfo} Contexte: ${o}. 100 mots max. Ton ${b.brand_tone}. ${htmlContract}`,
    facture: `Génère le CORPS HTML d'une facture professionnelle structurée avec <h2>Facture</h2>, un bloc émetteur/client en <p>, un tableau des prestations avec <table>, totaux HT/TVA/TTC en <p><strong>, conditions de paiement en <p>, mentions légales en fin. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Numéro FAC-2025-001, date du jour. ${htmlContract}`,
    devis: `Génère le CORPS HTML d'un devis professionnel avec <h2>Devis</h2>, bloc émetteur/client, tableau désignations, montants HT/TVA/TTC en <strong>, validité 30j, zone signature. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Numéro DEV-2025-001, date du jour. ${htmlContract}`,
    cgv: `Génère des CGV conformes au droit français, structurées avec <h2> pour chaque article. Inclure: objet, prix/paiement, livraison, rétractation, responsabilités, RGPD, litiges, identification du prestataire. Termine par <p><em>Disclaimer : ces CGV sont à valider par un professionnel juridique.</em></p>. ${brandInfo}. ${issuerInfo} Activité: ${b.brand_sector}. ${htmlContract}`,
  }
}

export function sanitizeBody(text: string): string {
  return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
}
