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

// Mails courts → image en pleine page, texte par-dessus.
// Docs longs (facture/devis/cgv) → image en bandeau hero + corps en section propre lisible.
const OVERLAY_DOCS = new Set(['bienvenue', 'remerciement', 'avis'])

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

// =========================================================
// Utils couleurs : luminance WCAG, saturation HSL, soften, contrastes
// =========================================================
function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(clean)) return [128, 128, 128]
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}

// Luminance relative WCAG (0 = noir, 1 = blanc)
function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function saturationHSL(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  const d = max - min
  return l > 0.5 ? d / (2 - max - min) : d / (max + min)
}

function mix(hex: string, towardHex: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(hex)
  const [r2, g2, b2] = hexToRgb(towardHex)
  return rgbToHex(r1 * (1 - ratio) + r2 * ratio, g1 * (1 - ratio) + g2 * ratio, b1 * (1 - ratio) + b2 * ratio)
}

// Couleur scrapée trop saturée ou trop extrême → on la rapproche d'un neutre
// pour qu'elle reste agréable en fond/dégradé.
function softenIfFlashy(hex: string): string {
  const sat = saturationHSL(hex)
  const lum = relativeLuminance(hex)
  if (sat > 0.85) {
    const neutral = lum > 0.5 ? '#F8F4ED' : '#1A1D26'
    return mix(hex, neutral, 0.28)
  }
  return hex
}

function lighten(hex: string, ratio: number): string {
  return mix(hex, '#FFFFFF', ratio)
}
function darken(hex: string, ratio: number): string {
  return mix(hex, '#000000', ratio)
}

// Texte qui contraste avec une couleur de fond (WCAG).
function textOn(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? '#15192A' : '#FFFFFF'
}

// Accent qui reste lisible sur un fond donné : si trop proche du fond,
// on le pousse vers l'extrême opposé.
function readableAccent(accentHex: string, bgHex: string): string {
  const lumBg = relativeLuminance(bgHex)
  const lumAcc = relativeLuminance(accentHex)
  const isBgDark = lumBg < 0.5
  if (isBgDark && lumAcc < 0.45) return lighten(accentHex, 0.55)
  if (!isBgDark && lumAcc > 0.7) return darken(accentHex, 0.55)
  return accentHex
}

// =========================================================
// Ton de marque → directives de staging et tonalité zone texte
// =========================================================
type ToneScheme = {
  zone: 'dark' | 'light'
  staging: string
  zoneDesc: string
}

function toneScheme(tone: string | undefined, colors: string[]): ToneScheme {
  const t = (tone || '').toLowerCase()
  // Si on a au moins une couleur, on laisse la luminance moyenne décider en cas d'ambiguïté
  const avgLum = colors.length ? colors.slice(0, 3).reduce((a, c) => a + relativeLuminance(c), 0) / Math.min(3, colors.length) : 0.6

  if (t.includes('luxe') || t.includes('premium') || t.includes('élég') || t.includes('haut de gamme')) {
    return {
      zone: 'dark',
      staging: 'produit posé sur surface élégante (bois sombre, marbre, velours), éclairage chaud doux et profond, dégradé sombre riche, ambiance feutrée et premium',
      zoneDesc: 'sombre et profonde, dégradé de tons foncés de la palette',
    }
  }
  if (t.includes('tech') || t.includes('moderne') || t.includes('innov') || t.includes('digital')) {
    return {
      zone: 'dark',
      staging: 'produit en perspective 3D trois-quart avec profondeur marquée, lignes géométriques nettes, fond dégradé technique sombre, mood épuré et futuriste',
      zoneDesc: 'sombre avec dégradé technique, tons profonds de la palette',
    }
  }
  if (t.includes('humour') || t.includes('fun') || t.includes('décal') || t.includes('jeune')) {
    return {
      zone: 'light',
      staging: 'composition décalée et joyeuse, formes arrondies colorées en arrière-plan, mood ludique, couleurs vives mais douces',
      zoneDesc: 'claire mais colorée, dégradé pastel doux de la palette',
    }
  }
  if (t.includes('nature') || t.includes('bio') || t.includes('eco') || t.includes('vert')) {
    return {
      zone: 'light',
      staging: 'produit dans contexte végétal organique discret, lumière naturelle douce, formes organiques apaisantes',
      zoneDesc: 'claire et naturelle, beige/crème/vert pâle harmonisé avec la palette',
    }
  }
  if (t.includes('pro') || t.includes('sérieux') || t.includes('corporate') || t.includes('institut')) {
    return {
      zone: 'light',
      staging: 'produit isolé sur fond uniforme clair, éclairage studio neutre, composition épurée minimaliste, ambiance institutionnelle propre',
      zoneDesc: 'claire et uniforme, ton pastel ou blanc cassé tiré de la palette',
    }
  }
  // Défaut : on suit la palette si elle est lisible
  return {
    zone: avgLum > 0.55 ? 'light' : 'dark',
    staging: 'composition équilibrée et harmonieuse, éclairage doux',
    zoneDesc: avgLum > 0.55 ? 'claire et harmonieuse, tons doux de la palette' : 'profonde et sobre, dégradé sombre de la palette',
  }
}

// =========================================================
// Palette résolue : couleurs scrapées soft + fallbacks intelligents
// =========================================================
type Palette = {
  c1: string // dominant (accent / titres / bordures / étoiles)
  c2: string // secondaire
  c3: string // tertiaire / fond
  bgLight: string // fond clair de fallback (zone texte light)
  bgDark: string // fond sombre de fallback (zone texte dark)
  accentOnLight: string
  accentOnDark: string
}

function resolvePalette(rawColors: string[], scheme: ToneScheme): Palette {
  const soft = (rawColors || []).filter(Boolean).slice(0, 3).map(softenIfFlashy)
  const c1 = soft[0] || (scheme.zone === 'dark' ? '#6E8CF0' : '#4F8EF7')
  const c2 = soft[1] || mix(c1, scheme.zone === 'dark' ? '#0F1224' : '#FFFFFF', 0.35)
  const c3 = soft[2] || mix(c1, scheme.zone === 'dark' ? '#000000' : '#F4EEE2', 0.55)
  // Fonds neutres tirés de la palette
  const bgLight = mix(c1, '#FBF8F2', 0.92)
  const bgDark = mix(c1, '#11131C', 0.85)
  return {
    c1,
    c2,
    c3,
    bgLight,
    bgDark,
    accentOnLight: readableAccent(c1, bgLight),
    accentOnDark: readableAccent(c1, bgDark),
  }
}

// =========================================================
// HTML builder — deux layouts (overlay / hero)
// =========================================================
export function buildHtml(opts: {
  brand: any
  profile: any
  docType: string
  sceneUrl: string | null
  bodyHtml: string
}): string {
  const { brand, profile, docType, sceneUrl, bodyHtml } = opts
  const colors = Array.isArray(brand.brand_colors) ? brand.brand_colors : []
  const scheme = toneScheme(brand.brand_tone, colors)
  const pal = resolvePalette(colors, scheme)
  const fonts = Array.isArray(brand.brand_fonts) ? brand.brand_fonts.filter(Boolean) : []
  const headingFont = fonts[0] ? `'${fonts[0]}', Georgia, serif` : `Georgia, serif`
  const bodyFont = fonts[1] || fonts[0] ? `'${fonts[1] || fonts[0]}', system-ui, sans-serif` : `system-ui, sans-serif`
  const brandName = brand.brand_name || brand.name || 'Marque'
  const footerBits = profile
    ? [profile.company_name, profile.siret && `SIRET ${profile.siret}`, profile.email_pro, profile.phone].filter(Boolean).join(' · ')
    : ''

  const isOverlay = OVERLAY_DOCS.has(docType)
  const isDark = scheme.zone === 'dark'

  // Bloc 5 étoiles pour la demande d'avis (couleur principale scrappée)
  const starsBlock =
    docType === 'avis'
      ? `<div class="doc-stars" aria-label="5 étoiles" data-editable-block="stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>`
      : ''

  const fallbackGradient = `linear-gradient(160deg, ${pal.c1} 0%, ${pal.c2} 55%, ${pal.c3} 100%)`

  // Variables CSS communes aux deux layouts
  const cssVars = `--c1:${pal.c1};--c2:${pal.c2};--c3:${pal.c3};--bg-light:${pal.bgLight};--bg-dark:${pal.bgDark};--accent-light:${pal.accentOnLight};--accent-dark:${pal.accentOnDark};--heading:${headingFont};--body:${bodyFont};`

  const html = isOverlay
    ? buildOverlayLayout({ brandName, docType, sceneUrl, bodyHtml, starsBlock, footerBits, fallbackGradient, isDark, cssVars, pal })
    : buildHeroLayout({ brandName, docType, sceneUrl, bodyHtml, starsBlock, footerBits, fallbackGradient, isDark, cssVars, pal })

  return html
}

type LayoutArgs = {
  brandName: string
  docType: string
  sceneUrl: string | null
  bodyHtml: string
  starsBlock: string
  footerBits: string
  fallbackGradient: string
  isDark: boolean
  cssVars: string
  pal: Palette
}

// Layout 1 — Image plein document, texte overlay dans la zone calme du haut.
// Le PNG produit est généré DANS la scène en bas par gpt-image-1, on réserve
// la moitié haute pour le texte via padding-bottom forcé.
function buildOverlayLayout(a: LayoutArgs): string {
  const { brandName, docType, sceneUrl, bodyHtml, starsBlock, footerBits, fallbackGradient, isDark, cssVars, pal } = a
  const textColor = isDark ? '#FFFFFF' : '#15192A'
  const accent = isDark ? pal.accentOnDark : pal.accentOnLight
  const scrim = isDark
    ? 'linear-gradient(180deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.10) 60%, rgba(0,0,0,0.60) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.30) 35%, rgba(255,255,255,0.10) 60%, rgba(255,255,255,0.55) 100%)'
  const tableSurface = isDark ? 'rgba(0,0,0,0.48)' : 'rgba(255,255,255,0.82)'
  const tableBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)'
  const footerBorder = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)'
  const textShadow = isDark ? '0 1px 10px rgba(0,0,0,0.55)' : '0 1px 6px rgba(255,255,255,0.6)'

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(brandName)} — ${escapeHtml(DOC_TYPE_LABELS[docType] || docType)}</title>
<style>
:root{${cssVars}--text:${textColor};--accent:${accent};}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#1c1f2a;}
body{font-family:var(--body);color:var(--text);line-height:1.65;padding:24px;min-height:100vh;}
.doc{position:relative;max-width:820px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,0.30);min-height:1200px;}
.doc-scene{position:absolute;inset:0;z-index:0;background:${sceneUrl ? `url('${escapeHtml(sceneUrl)}')` : fallbackGradient};background-size:cover;background-position:top center;background-repeat:no-repeat;}
.doc-scrim{position:absolute;inset:0;z-index:1;background:${scrim};pointer-events:none;}
.doc-content{position:relative;z-index:2;padding:64px 60px 32px;color:var(--text);text-shadow:${textShadow};padding-bottom:580px;}
.doc-header{padding-bottom:24px;border-bottom:3px solid var(--accent);margin-bottom:36px;}
.doc-brand{font-family:var(--heading);font-size:48px;font-weight:800;line-height:1.05;letter-spacing:-1px;color:var(--text);}
.doc-sub{font-size:13px;margin-top:14px;text-transform:uppercase;letter-spacing:3px;font-weight:700;color:var(--accent);text-shadow:none;}
.doc-body h1{font-family:var(--heading);font-size:36px;font-weight:700;margin:28px 0 14px;color:var(--text);line-height:1.15;}
.doc-body h2{font-family:var(--heading);font-size:28px;font-weight:700;margin:26px 0 12px;color:var(--text);border-left:5px solid var(--accent);padding-left:16px;line-height:1.2;}
.doc-body h3{font-family:var(--heading);font-size:20px;font-weight:600;margin:20px 0 10px;color:var(--accent);text-shadow:none;}
.doc-body p{margin-bottom:16px;font-size:16px;}
.doc-body strong{color:var(--accent);font-weight:700;text-shadow:none;}
.doc-body ul,.doc-body ol{padding-left:22px;margin-bottom:14px;}
.doc-body li{margin-bottom:6px;}
.doc-body table{width:100%;border-collapse:collapse;margin:18px 0;background:${tableSurface};border-radius:10px;overflow:hidden;backdrop-filter:blur(6px);}
.doc-body th,.doc-body td{padding:12px 14px;border-bottom:1px solid ${tableBorder};text-align:left;text-shadow:none;}
.doc-body th{background:var(--accent);color:${textOn(accent)};font-family:var(--heading);font-weight:600;}
.doc-stars{margin:28px 0 8px;text-align:center;font-size:48px;letter-spacing:10px;color:var(--c1);text-shadow:none;line-height:1;}
.doc-stars span{display:inline-block;transition:transform .15s;}
.doc-stars span:hover{transform:scale(1.12);}
.doc-footer{position:relative;z-index:2;margin:0 60px;padding:16px 0 26px;font-size:11px;color:var(--text);border-top:1px solid ${footerBorder};opacity:0.85;text-shadow:none;}
[contenteditable="true"]{outline:2px dashed rgba(255,255,255,.55);outline-offset:6px;border-radius:4px;}
@media print{body{background:#fff;padding:0;}.doc{box-shadow:none;border-radius:0;}}
</style></head>
<body>
<div class="doc" data-brandsheet="${escapeHtml(docType)}">
  <div class="doc-scene"></div>
  <div class="doc-scrim"></div>
  <div class="doc-content">
    <div class="doc-header">
      <div class="doc-brand">${escapeHtml(brandName)}</div>
      <div class="doc-sub">${escapeHtml(DOC_TYPE_LABELS[docType] || docType)}</div>
    </div>
    <div class="doc-body" data-editable="true">${bodyHtml}${starsBlock}</div>
  </div>
  ${footerBits ? `<div class="doc-footer">${escapeHtml(footerBits)}</div>` : ''}
</div>
${editorScript()}
</body></html>`
}

// Layout 2 — Image en bandeau hero (450px) + corps en section claire/sombre lisible.
// Pour facture/devis/cgv : le contenu peut être long, on garantit la lisibilité.
function buildHeroLayout(a: LayoutArgs): string {
  const { brandName, docType, sceneUrl, bodyHtml, footerBits, fallbackGradient, isDark, cssVars, pal } = a
  // Section body : on choisit clair par défaut pour rester lisible quel que soit le ton
  const bodyBg = isDark ? pal.bgDark : pal.bgLight
  const bodyText = textOn(bodyBg)
  const accent = isDark ? pal.accentOnDark : pal.accentOnLight
  const heroTextColor = isDark ? '#FFFFFF' : '#15192A'
  const heroScrim = isDark
    ? 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.55) 100%)'
  const tableBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)'
  const tableHeadBg = accent

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(brandName)} — ${escapeHtml(DOC_TYPE_LABELS[docType] || docType)}</title>
<style>
:root{${cssVars}--text:${bodyText};--accent:${accent};}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#1c1f2a;}
body{font-family:var(--body);color:var(--text);line-height:1.65;padding:24px;min-height:100vh;}
.doc{position:relative;max-width:820px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,0.30);background:${bodyBg};}
.doc-hero{position:relative;height:460px;overflow:hidden;}
.doc-hero-bg{position:absolute;inset:0;background:${sceneUrl ? `url('${escapeHtml(sceneUrl)}')` : fallbackGradient};background-size:cover;background-position:top center;background-repeat:no-repeat;}
.doc-hero-scrim{position:absolute;inset:0;background:${heroScrim};}
.doc-hero-content{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:48px 60px 36px;color:${heroTextColor};text-shadow:${isDark ? '0 2px 12px rgba(0,0,0,0.5)' : '0 1px 6px rgba(255,255,255,0.6)'};}
.doc-brand{font-family:var(--heading);font-size:52px;font-weight:800;line-height:1.05;letter-spacing:-1px;}
.doc-sub{font-size:13px;margin-top:14px;text-transform:uppercase;letter-spacing:3px;font-weight:700;color:var(--accent);text-shadow:none;}
.doc-content{padding:48px 60px 36px;color:var(--text);}
.doc-body h1{font-family:var(--heading);font-size:34px;font-weight:700;margin:24px 0 12px;color:var(--text);line-height:1.15;}
.doc-body h2{font-family:var(--heading);font-size:26px;font-weight:700;margin:24px 0 12px;color:var(--text);border-left:5px solid var(--accent);padding-left:16px;line-height:1.2;}
.doc-body h3{font-family:var(--heading);font-size:19px;font-weight:600;margin:18px 0 10px;color:var(--accent);}
.doc-body p{margin-bottom:14px;font-size:15px;}
.doc-body strong{color:var(--accent);font-weight:700;}
.doc-body ul,.doc-body ol{padding-left:22px;margin-bottom:14px;}
.doc-body li{margin-bottom:6px;}
.doc-body table{width:100%;border-collapse:collapse;margin:18px 0;border:1px solid ${tableBorder};border-radius:8px;overflow:hidden;}
.doc-body th,.doc-body td{padding:12px 14px;border-bottom:1px solid ${tableBorder};text-align:left;}
.doc-body th{background:${tableHeadBg};color:${textOn(accent)};font-family:var(--heading);font-weight:600;}
.doc-footer{margin:0 60px;padding:16px 0 28px;font-size:11px;color:var(--text);border-top:1px solid ${tableBorder};opacity:0.75;}
[contenteditable="true"]{outline:2px dashed ${isDark ? 'rgba(255,255,255,.45)' : 'rgba(79,142,247,.55)'};outline-offset:6px;border-radius:4px;}
@media print{body{background:#fff;padding:0;}.doc{box-shadow:none;border-radius:0;}}
</style></head>
<body>
<div class="doc" data-brandsheet="${escapeHtml(docType)}">
  <div class="doc-hero">
    <div class="doc-hero-bg"></div>
    <div class="doc-hero-scrim"></div>
    <div class="doc-hero-content">
      <div class="doc-brand">${escapeHtml(brandName)}</div>
      <div class="doc-sub">${escapeHtml(DOC_TYPE_LABELS[docType] || docType)}</div>
    </div>
  </div>
  <div class="doc-content">
    <div class="doc-body" data-editable="true">${bodyHtml}</div>
  </div>
  ${footerBits ? `<div class="doc-footer">${escapeHtml(footerBits)}</div>` : ''}
</div>
${editorScript()}
</body></html>`
}

function editorScript(): string {
  return `<script>
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
</script>`
}

// =========================================================
// Image scène : un seul appel gpt-image-1, produit en bas + zone calme en haut
// =========================================================
async function uploadImage(buffer: Buffer, userId: string, opId: string): Promise<string> {
  const path = `${userId}/${opId}/scene-${Date.now()}.png`
  const { error: upErr } = await supabaseAdmin.storage.from('operations').upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  })
  if (upErr) throw upErr
  const { data: pub } = supabaseAdmin.storage.from('operations').getPublicUrl(path)
  return pub.publicUrl
}

export async function generateSceneImage(prompt: string, userId: string, opId: string): Promise<string> {
  const openai = getOpenAI()
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1536',
    quality: 'medium',
    n: 1,
  })
  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('Aucune image scène renvoyée par gpt-image-1')
  return uploadImage(Buffer.from(b64, 'base64'), userId, opId)
}

export function buildScenePrompt(brand: any, operation: any): string {
  const colors = Array.isArray(brand.brand_colors) ? brand.brand_colors : []
  const palette = colors.slice(0, 3).join(', ') || 'tons neutres'
  const tone = brand.brand_tone || 'professionnel'
  const scheme = toneScheme(tone, colors)
  const subject = operation?.description || operation?.name || `produit représentant la marque ${brand.brand_name || brand.name}`
  return `Visuel branded complet pour document A4 portrait. Sujet à mettre en scène : ${subject}. Marque : ${brand.brand_name || brand.name}, secteur ${brand.brand_sector || 'générique'}, ton ${tone}.

STAGING : ${scheme.staging}. Le sujet/produit doit occuper UNIQUEMENT la moitié BASSE de l'image (les 50% inférieurs), mis en valeur.

PALETTE EXCLUSIVE : ${palette} (utilise uniquement ces couleurs et leurs nuances, aucune autre).

ZONE TEXTE — CRITIQUE : la moitié HAUTE de l'image (les 50% supérieurs) doit être une zone CALME, UNIFORME OU TRÈS DOUCEMENT DÉGRADÉE, ${scheme.zoneDesc}. AUCUN détail complexe, AUCUN objet, AUCUN sujet, AUCUN contraste fort dans cette zone — c'est là que du texte sera incrusté par-dessus. Le contraste entre la zone calme du haut et le sujet en bas doit être net mais harmonieux.

CONTRAINTES STRICTES : aucun texte dans l'image, aucun logo, aucun caractère, aucun chiffre, aucune signature. Photo/rendu réaliste de qualité éditoriale.`
}

// =========================================================
// Prompts texte (inchangé sauf injection 5 étoiles côté HTML pour 'avis')
// =========================================================
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
    avis: `Rédige le CORPS HTML d'un mail de demande d'avis client (un bloc visuel 5 étoiles sera ajouté automatiquement après ton texte, ne le mentionne pas mais invite à laisser une note). Commence par <h2>Objet : ...</h2>. ${brandInfo}. ${issuerInfo} Contexte: ${o}. 100 mots max. Ton ${b.brand_tone}. ${htmlContract}`,
    facture: `Génère le CORPS HTML d'une facture professionnelle structurée avec <h2>Facture</h2>, un bloc émetteur/client en <p>, un tableau des prestations avec <table>, totaux HT/TVA/TTC en <p><strong>, conditions de paiement en <p>, mentions légales en fin. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Numéro FAC-2025-001, date du jour. ${htmlContract}`,
    devis: `Génère le CORPS HTML d'un devis professionnel avec <h2>Devis</h2>, bloc émetteur/client, tableau désignations, montants HT/TVA/TTC en <strong>, validité 30j, zone signature. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Numéro DEV-2025-001, date du jour. ${htmlContract}`,
    cgv: `Génère des CGV conformes au droit français, structurées avec <h2> pour chaque article. Inclure: objet, prix/paiement, livraison, rétractation, responsabilités, RGPD, litiges, identification du prestataire. Termine par <p><em>Disclaimer : ces CGV sont à valider par un professionnel juridique.</em></p>. ${brandInfo}. ${issuerInfo} Activité: ${b.brand_sector}. ${htmlContract}`,
  }
}

export function sanitizeBody(text: string): string {
  return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
}
