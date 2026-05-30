import { toFile } from 'openai'
import { supabaseAdmin } from './supabase-admin'
import { getOpenAI } from './openai'

export const DOC_TYPE_LABELS: Record<string, string> = {
  // Fiches actives
  facture: 'Facture',
  remerciement: 'Fiche remerciement',
  devis: 'Devis',
  relance: 'Relance',
  nouveaute: 'Nouveauté',
  forfait: 'Forfait',
  // Mails actifs (réservés aux plans payants)
  mail_remerciement: 'Mail remerciement',
  mail_marketing: 'Mail marketing',
  // Labels conservés pour que les anciens documents s'affichent proprement dans
  // l'historique. Les prompts associés ont été retirés : régénérer un de ces
  // anciens docs est désormais impossible (acceptable, ce sont des archives).
  bienvenue: 'Mail de bienvenue',
  avis: 'Demande d\'avis',
  cgv: 'Conditions Générales de Vente',
}

/** Types de docs proposés à la génération à la carte (ordre = ordre UI). */
export const ACTIVE_DOC_TYPES = [
  'facture',
  'remerciement',
  'devis',
  'relance',
  'nouveaute',
  'forfait',
  'mail_remerciement',
  'mail_marketing',
] as const
export type ActiveDocType = (typeof ACTIVE_DOC_TYPES)[number]

/** Mails : gated aux plans payants, layout overlay court, intégration Gmail. */
export const MAIL_DOC_TYPES = new Set<string>(['mail_remerciement', 'mail_marketing'])

/** Docs avec bloc 5 étoiles toujours visible. */
const FIVE_STARS_DOCS = new Set<string>(['remerciement', 'mail_remerciement'])

/**
 * Type de compte. Pilote la voix du document :
 * - 'brand'     : le document parle AU NOM de la marque scrapée (présente
 *                 son propre produit/service à ses clients).
 * - 'freelance' : le document est envoyé PAR le freelance (profil) AU
 *                 client (contact). Le contact scrapé donne uniquement les
 *                 couleurs/le ton ; le document parle au nom du freelance.
 * Réglable à tout moment depuis /dashboard/profil ; les anciens documents
 * gardent leur état au moment de la génération.
 */
export type AccountType = 'freelance' | 'brand'

// Mails courts → image en pleine page, texte par-dessus.
// Fiches → image en bandeau hero + corps en section propre lisible.
// Nouveauté → layout dédié (image produit centrée XL + mot "NOUVEAUTÉ").
const OVERLAY_DOCS = new Set(['mail_remerciement', 'mail_marketing'])
const NOUVEAUTE_DOCS = new Set(['nouveaute'])

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
  productImageUrl?: string | null
  accountType?: AccountType
}): string {
  const { brand, profile, docType, sceneUrl, bodyHtml, productImageUrl, accountType = 'freelance' } = opts
  const colors = Array.isArray(brand.brand_colors) ? brand.brand_colors : []
  const scheme = toneScheme(brand.brand_tone, colors)
  const pal = resolvePalette(colors, scheme)
  const fonts = Array.isArray(brand.brand_fonts) ? brand.brand_fonts.filter(Boolean) : []
  const headingFont = fonts[0] ? `'${fonts[0]}', Georgia, serif` : `Georgia, serif`
  const bodyFont = fonts[1] || fonts[0] ? `'${fonts[1] || fonts[0]}', system-ui, sans-serif` : `system-ui, sans-serif`
  const clientBrandName = brand.brand_name || brand.name || 'Marque'
  const freelanceName = (profile?.company_name || profile?.full_name || '').trim() || clientBrandName
  // En mode brand, le document parle au nom de la marque scrapée → titre = nom de marque.
  // En mode freelance, c'est le freelance qui envoie → titre = nom du freelance,
  // sous-titre rappelle qu'il s'adresse à la marque cliente.
  const headerName = accountType === 'brand' ? clientBrandName : freelanceName
  const headerSub = accountType === 'brand'
    ? (DOC_TYPE_LABELS[docType] || docType)
    : `Pour ${clientBrandName} · ${DOC_TYPE_LABELS[docType] || docType}`
  const footerBits = profile
    ? [profile.company_name, profile.siret && `SIRET ${profile.siret}`, profile.email_pro, profile.phone].filter(Boolean).join(' · ')
    : ''

  const isOverlay = OVERLAY_DOCS.has(docType)
  const isNouveaute = NOUVEAUTE_DOCS.has(docType)
  const isDark = scheme.zone === 'dark'
  const isFiveStars = FIVE_STARS_DOCS.has(docType)

  // 5 étoiles : disposées verticalement (une par ligne) — c'est la mise en
  // page demandée pour la fiche/le mail remerciement.
  const starsBlock = isFiveStars
    ? `<div class="doc-stars" aria-label="5 étoiles" data-editable-block="stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>`
    : ''

  // En mode freelance, on imprime un petit rappel graphique du produit du
  // client (image originale uploadée par l'user) flottant à côté du texte
  // de remerciement. C'est un rappel visuel, le produit est aussi présent
  // dans la scène IA de fond — mais ici à l'identique de la source.
  const floatingProductBlock = accountType === 'freelance' && isFiveStars && productImageUrl
    ? `<img class="doc-floating-product" src="${escapeHtml(productImageUrl)}" alt="" aria-hidden="true" />`
    : ''

  const fallbackGradient = `linear-gradient(160deg, ${pal.c1} 0%, ${pal.c2} 55%, ${pal.c3} 100%)`

  const cssVars = `--c1:${pal.c1};--c2:${pal.c2};--c3:${pal.c3};--bg-light:${pal.bgLight};--bg-dark:${pal.bgDark};--accent-light:${pal.accentOnLight};--accent-dark:${pal.accentOnDark};--heading:${headingFont};--body:${bodyFont};`

  if (isNouveaute) {
    return buildNouveauteLayout({ brandName: headerName, headerSub, docType, productImageUrl: productImageUrl || null, bodyHtml, footerBits, fallbackGradient, isDark, cssVars, pal })
  }
  return isOverlay
    ? buildOverlayLayout({ brandName: headerName, headerSub, docType, sceneUrl, bodyHtml, starsBlock, floatingProductBlock, footerBits, fallbackGradient, isDark, cssVars, pal })
    : buildHeroLayout({ brandName: headerName, headerSub, docType, sceneUrl, bodyHtml, starsBlock, floatingProductBlock, footerBits, fallbackGradient, isDark, cssVars, pal })
}

type LayoutArgs = {
  brandName: string
  headerSub: string
  docType: string
  sceneUrl: string | null
  bodyHtml: string
  starsBlock: string
  floatingProductBlock: string
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
  const { brandName, headerSub, docType, sceneUrl, bodyHtml, starsBlock, floatingProductBlock, footerBits, fallbackGradient, isDark, cssVars, pal } = a
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
.doc-body{position:relative;}
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
.doc-stars{margin:28px auto 8px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:42px;color:var(--c1);text-shadow:none;line-height:1;}
.doc-stars span{display:block;transition:transform .15s;}
.doc-stars span:hover{transform:scale(1.18);}
.doc-floating-product{float:right;width:170px;height:auto;margin:0 -20px 18px 22px;border-radius:14px;object-fit:contain;filter:drop-shadow(0 18px 32px rgba(0,0,0,0.45));transform:rotate(3deg);background:rgba(255,255,255,0.04);}
.doc-footer{position:relative;z-index:2;margin:0 60px;padding:16px 0 26px;font-size:11px;color:var(--text);border-top:1px solid ${footerBorder};opacity:0.85;text-shadow:none;}
[contenteditable="true"]{outline:2px dashed rgba(255,255,255,.55);outline-offset:6px;border-radius:4px;}
@media print{body{background:#fff;padding:0;}.doc{box-shadow:none;border-radius:0;}}
@media(max-width:600px){.doc-floating-product{width:120px;margin:0 -10px 12px 14px;}}
</style></head>
<body>
<div class="doc" data-brandsheet="${escapeHtml(docType)}">
  <div class="doc-scene"></div>
  <div class="doc-scrim"></div>
  <div class="doc-content">
    <div class="doc-header">
      <div class="doc-brand">${escapeHtml(brandName)}</div>
      <div class="doc-sub">${escapeHtml(headerSub)}</div>
    </div>
    <div class="doc-body" data-editable="true">${floatingProductBlock}${bodyHtml}${starsBlock}</div>
  </div>
  ${footerBits ? `<div class="doc-footer">${escapeHtml(footerBits)}</div>` : ''}
</div>
${editorScript()}
</body></html>`
}

// Layout 3 — Nouveauté : image produit upload de l'opération à l'identique, en
// gros au centre, sous laquelle on imprime "NOUVEAUTÉ" en majuscules dans la
// typo scrapée. Texte court de l'IA en dessous. Aucun rendu IA de scène : on
// utilise l'image originale telle qu'uploadée par l'user.
function buildNouveauteLayout(a: {
  brandName: string
  headerSub: string
  docType: string
  productImageUrl: string | null
  bodyHtml: string
  footerBits: string
  fallbackGradient: string
  isDark: boolean
  cssVars: string
  pal: Palette
}): string {
  const { brandName, headerSub, docType, productImageUrl, bodyHtml, footerBits, fallbackGradient, isDark, cssVars, pal } = a
  const bg = isDark ? pal.bgDark : pal.bgLight
  const text = textOn(bg)
  const accent = isDark ? pal.accentOnDark : pal.accentOnLight
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  const productBlock = productImageUrl
    ? `<img class="nouveaute-product" src="${escapeHtml(productImageUrl)}" alt="${escapeHtml(brandName)}" />`
    : `<div class="nouveaute-product nouveaute-fallback" style="background:${fallbackGradient};"></div>`

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(brandName)} — ${escapeHtml(DOC_TYPE_LABELS[docType] || docType)}</title>
<style>
:root{${cssVars}--text:${text};--accent:${accent};--bg:${bg};}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#1c1f2a;}
body{font-family:var(--body);color:var(--text);line-height:1.6;padding:24px;min-height:100vh;}
.doc{position:relative;max-width:820px;margin:0 auto;border-radius:16px;overflow:hidden;background:var(--bg);box-shadow:0 14px 50px rgba(0,0,0,0.30);}
.nouveaute-top{padding:48px 60px 14px;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid ${borderColor};}
.nouveaute-brand{font-family:var(--heading);font-size:28px;font-weight:800;letter-spacing:-0.5px;color:var(--text);}
.nouveaute-tag{font-size:11px;text-transform:uppercase;letter-spacing:4px;color:var(--accent);font-weight:700;}
.nouveaute-stage{padding:48px 40px 16px;display:flex;align-items:center;justify-content:center;min-height:520px;}
.nouveaute-product{display:block;max-width:560px;max-height:560px;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,0.25));}
.nouveaute-fallback{width:560px;height:420px;border-radius:18px;}
.nouveaute-title{font-family:var(--heading);font-size:96px;font-weight:900;line-height:1;text-align:center;letter-spacing:6px;text-transform:uppercase;margin:24px 40px 8px;color:var(--text);}
.nouveaute-title em{font-style:normal;background:linear-gradient(120deg, var(--c1), var(--c2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.nouveaute-body{padding:8px 80px 36px;text-align:center;font-size:16px;color:var(--text);}
.nouveaute-body p{margin-bottom:10px;}
.nouveaute-body strong{color:var(--accent);}
.doc-footer{margin:0 60px;padding:14px 0 26px;font-size:11px;color:var(--text);border-top:1px solid ${borderColor};opacity:0.7;}
[contenteditable="true"]{outline:2px dashed ${isDark ? 'rgba(255,255,255,.45)' : 'rgba(79,142,247,.55)'};outline-offset:6px;border-radius:4px;}
@media print{body{background:#fff;padding:0;}.doc{box-shadow:none;border-radius:0;}}
@media(max-width:600px){.nouveaute-title{font-size:56px;letter-spacing:3px;}.nouveaute-stage{min-height:340px;padding:32px 20px 8px;}.nouveaute-product{max-width:90%;max-height:380px;}.nouveaute-top,.nouveaute-body{padding-left:24px;padding-right:24px;}.doc-footer{margin:0 24px;}}
</style></head>
<body>
<div class="doc" data-brandsheet="${escapeHtml(docType)}">
  <div class="nouveaute-top">
    <div class="nouveaute-brand">${escapeHtml(brandName)}</div>
    <div class="nouveaute-tag">${escapeHtml(headerSub)}</div>
  </div>
  <div class="nouveaute-stage">${productBlock}</div>
  <h1 class="nouveaute-title"><em>NOUVEAUTÉ</em></h1>
  <div class="nouveaute-body" data-editable="true">${bodyHtml}</div>
  ${footerBits ? `<div class="doc-footer">${escapeHtml(footerBits)}</div>` : ''}
</div>
${editorScript()}
</body></html>`
}

// Layout 2 — Image en bandeau hero (450px) + corps en section claire/sombre lisible.
// Pour facture/devis/cgv : le contenu peut être long, on garantit la lisibilité.
function buildHeroLayout(a: LayoutArgs): string {
  const { brandName, headerSub, docType, sceneUrl, bodyHtml, starsBlock, floatingProductBlock, footerBits, fallbackGradient, isDark, cssVars, pal } = a
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
.doc-body{position:relative;}
.doc-stars{margin:24px auto 8px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:38px;color:var(--c1);line-height:1;}
.doc-stars span{display:block;transition:transform .15s;}
.doc-stars span:hover{transform:scale(1.18);}
.doc-floating-product{float:right;width:170px;height:auto;margin:4px -20px 18px 22px;border-radius:14px;object-fit:contain;filter:drop-shadow(0 18px 32px rgba(0,0,0,0.35));transform:rotate(3deg);background:transparent;}
.doc-footer{margin:0 60px;padding:16px 0 28px;font-size:11px;color:var(--text);border-top:1px solid ${tableBorder};opacity:0.75;}
[contenteditable="true"]{outline:2px dashed ${isDark ? 'rgba(255,255,255,.45)' : 'rgba(79,142,247,.55)'};outline-offset:6px;border-radius:4px;}
@media print{body{background:#fff;padding:0;}.doc{box-shadow:none;border-radius:0;}}
@media(max-width:600px){.doc-floating-product{width:120px;margin:0 -10px 12px 14px;}}
</style></head>
<body>
<div class="doc" data-brandsheet="${escapeHtml(docType)}">
  <div class="doc-hero">
    <div class="doc-hero-bg"></div>
    <div class="doc-hero-scrim"></div>
    <div class="doc-hero-content">
      <div class="doc-brand">${escapeHtml(brandName)}</div>
      <div class="doc-sub">${escapeHtml(headerSub)}</div>
    </div>
  </div>
  <div class="doc-content">
    <div class="doc-body" data-editable="true">${floatingProductBlock}${bodyHtml}${starsBlock}</div>
  </div>
  ${footerBits ? `<div class="doc-footer">${escapeHtml(footerBits)}</div>` : ''}
</div>
${editorScript()}
</body></html>`
}

// =========================================================
// Mail clipboard — HTML inline-stylé, prêt à coller dans Gmail compose.
// Gmail strippe les <style> et les background-image CSS. On rebuild donc le
// mail en table+inline styles, avec un <img> pour la scène et tous les styles
// inlinés sur chaque tag. C'est la seule façon d'avoir image + couleurs
// préservées au paste dans Gmail.
// =========================================================
export function buildMailClipboardHtml(opts: {
  brand: any
  profile: any
  docType: string
  sceneUrl: string | null
  bodyHtml: string
  accountType?: AccountType
}): { subject: string; html: string; plain: string } {
  const { brand, profile, sceneUrl, bodyHtml, accountType = 'freelance' } = opts
  const colors = Array.isArray(brand.brand_colors) ? brand.brand_colors : []
  const scheme = toneScheme(brand.brand_tone, colors)
  const pal = resolvePalette(colors, scheme)
  const fonts = Array.isArray(brand.brand_fonts) ? brand.brand_fonts.filter(Boolean) : []
  // Polices web only : Arial/Georgia comme fallback robuste (Gmail ne charge
  // pas Google Fonts dans le compose).
  const headingFont = fonts[0] ? `'${fonts[0]}', Georgia, 'Times New Roman', serif` : `Georgia, 'Times New Roman', serif`
  const bodyFont = (fonts[1] || fonts[0]) ? `'${fonts[1] || fonts[0]}', Arial, Helvetica, sans-serif` : `Arial, Helvetica, sans-serif`
  const isDark = scheme.zone === 'dark'
  const bg = isDark ? pal.bgDark : pal.bgLight
  const textColor = textOn(bg)
  const accent = isDark ? pal.accentOnDark : pal.accentOnLight

  const clientBrandName = brand.brand_name || brand.name || 'Marque'
  const freelanceName = (profile?.company_name || profile?.full_name || '').trim() || clientBrandName
  const headerName = accountType === 'brand' ? clientBrandName : freelanceName

  // Sépare l'objet (premier <h2>Objet : XXX</h2>) du reste.
  const subjMatch = bodyHtml.match(/<h2[^>]*>\s*Objet\s*:?\s*([^<]*)<\/h2>/i)
  const subject = (subjMatch?.[1] || '').trim()
  let cleanBody = bodyHtml.replace(/<h2[^>]*>\s*Objet[\s\S]*?<\/h2>/i, '').trim()
  // Supprime un éventuel bloc étoiles (visuel HTML/CSS) — on remettra des ★ texte.
  cleanBody = cleanBody.replace(/<div[^>]*class="doc-stars"[\s\S]*?<\/div>/gi, '').trim()

  const bodyStyled = inlineStyleEmailBody(cleanBody, { textColor, accent, headingFont, bodyFont })
  const starsLine = opts.docType === 'mail_remerciement'
    ? `<div style="text-align:center;font-size:32px;letter-spacing:6px;color:${pal.c1};margin:18px 0 6px;">★★★★★</div>`
    : ''

  const sceneImg = sceneUrl
    ? `<img src="${escapeHtml(sceneUrl)}" alt="${escapeHtml(headerName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />`
    : ''

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="border-collapse:collapse;width:100%;max-width:600px;margin:0 auto;background:${bg};font-family:${bodyFont};color:${textColor};">
  <tr><td style="padding:0;line-height:0;">${sceneImg}</td></tr>
  <tr><td style="padding:28px 32px 8px;">
    <div style="font-family:${headingFont};font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:18px;">${escapeHtml(headerName)}</div>
  </td></tr>
  <tr><td style="padding:0 32px 28px;font-family:${bodyFont};color:${textColor};font-size:15px;line-height:1.65;">
    ${bodyStyled}
    ${starsLine}
  </td></tr>
</table>`

  // Version texte (fallback clipboard) — strip des balises.
  const plain = (subject ? `Objet : ${subject}\n\n` : '') +
    cleanBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h2|h3|li)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim()

  return { subject, html, plain }
}

function inlineStyleEmailBody(
  html: string,
  ctx: { textColor: string; accent: string; headingFont: string; bodyFont: string },
): string {
  return html
    .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="font-family:${ctx.headingFont};font-size:22px;color:${ctx.textColor};margin:18px 0 10px;line-height:1.25;font-weight:700;">`)
    .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="font-family:${ctx.headingFont};font-size:17px;color:${ctx.accent};margin:14px 0 8px;line-height:1.3;font-weight:600;">`)
    .replace(/<p(\s[^>]*)?>/gi, `<p style="font-family:${ctx.bodyFont};font-size:15px;line-height:1.65;color:${ctx.textColor};margin:0 0 12px;">`)
    .replace(/<strong(\s[^>]*)?>/gi, `<strong style="color:${ctx.accent};font-weight:700;">`)
    .replace(/<ul(\s[^>]*)?>/gi, `<ul style="padding-left:22px;margin:0 0 12px;color:${ctx.textColor};">`)
    .replace(/<ol(\s[^>]*)?>/gi, `<ol style="padding-left:22px;margin:0 0 12px;color:${ctx.textColor};">`)
    .replace(/<li(\s[^>]*)?>/gi, `<li style="margin:0 0 6px;font-size:15px;line-height:1.6;font-family:${ctx.bodyFont};color:${ctx.textColor};">`)
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

export type SceneQuality = 'medium' | 'high'

export async function generateSceneImage(
  prompt: string,
  refImageUrls: string[],
  userId: string,
  opId: string,
  quality: SceneQuality = 'medium',
): Promise<string> {
  if (!refImageUrls || refImageUrls.length === 0) {
    throw new Error("Aucune image de référence : ajoute au moins une photo du produit/service à l'opération")
  }
  const openai = getOpenAI()

  const refs = await Promise.all(
    refImageUrls.slice(0, 4).map(async (url, i) => {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`Impossible de lire l'image de référence ${i + 1} (HTTP ${resp.status})`)
      const buf = Buffer.from(await resp.arrayBuffer())
      const type = resp.headers.get('content-type') || 'image/png'
      const ext = type.includes('jpeg') || type.includes('jpg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png'
      return toFile(buf, `ref-${i}.${ext}`, { type })
    }),
  )

  const result = await openai.images.edit({
    model: 'gpt-image-1',
    image: refs,
    prompt,
    size: '1024x1536',
    quality,
    n: 1,
  })
  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('Aucune image scène renvoyée par gpt-image-1')
  return uploadImage(Buffer.from(b64, 'base64'), userId, opId)
}

export function buildScenePrompt(brand: any, operation: any, accountType: AccountType = 'freelance'): string {
  const colors = Array.isArray(brand.brand_colors) ? brand.brand_colors : []
  const palette = colors.slice(0, 3).join(', ') || 'tons neutres'
  const tone = brand.brand_tone || 'professionnel'
  const scheme = toneScheme(tone, colors)
  const brandName = brand.brand_name || brand.name
  const userDirection = (operation?.description || '').trim()

  // Si l'utilisateur a écrit une consigne explicite dans la description de
  // l'opération, c'est elle qui pilote la composition. La staging par défaut
  // (déduite du ton de marque) n'est utilisée que comme fallback — sinon le
  // bloc générique écrase systématiquement la consigne utilisateur, qui se
  // retrouvait noyée dans un seul "Contexte: ..." inerte.
  const stagingBlock = userDirection
    ? `DIRECTION CRÉATIVE (consigne utilisateur — PRIORITÉ ABSOLUE, tout le reste est secondaire) :
"${userDirection}"

Respecte cette direction à la lettre pour l'ambiance, les matières, le fond et le rendu général. Les sections "PALETTE" et "ZONE TEXTE" ci-dessous ne doivent pas la contredire.`
    : `AMBIANCE PAR DÉFAUT (aucune consigne explicite — déduite du ton de marque) : ${scheme.staging}.`

  // En mode brand, l'image illustre LE produit de la marque. En mode freelance,
  // les images racontent une MISSION — par exemple l'outil du freelance (micro,
  // appareil photo, écran...) côtoyant le produit du client. TOUS les éléments
  // de référence doivent être visibles dans la scène, pas seulement un.
  const subjectBlock = accountType === 'brand'
    ? `PRODUIT — OBLIGATOIRE : les image(s) fournies en référence montrent le produit RÉEL à mettre en scène. Reproduis-le FIDÈLEMENT (forme exacte, proportions, couleurs, matière, texture, détails distinctifs). Ne pas inventer un autre produit, ne pas styliser, ne pas changer ses couleurs. Le produit doit être VISIBLE et IDENTIFIABLE dans la moitié basse — la sortie ne doit PAS être un simple dégradé, le produit fait partie intégrante de l'image.`
    : `ÉLÉMENTS DE LA MISSION — TOUS OBLIGATOIRES : les images fournies en référence montrent les éléments réels de la mission du freelance (par exemple l'outil de travail du freelance ET le produit du client). Reproduis-les TOUS FIDÈLEMENT (forme exacte, proportions, couleurs, matière, texture, détails distinctifs). N'invente pas, ne stylise pas, ne change pas leurs couleurs. TOUS les éléments doivent être VISIBLES et IDENTIFIABLES ensemble dans la moitié basse, mis en relation pour évoquer la mission accomplie. N'en omets AUCUN. La sortie ne doit PAS être un simple dégradé.`

  return `Visuel branded pour document A4 portrait. Marque (palette/ambiance) : ${brandName}, secteur ${brand.brand_sector || 'générique'}, ton ${tone}.

${stagingBlock}

${subjectBlock}

COMPOSITION :
- Moitié BASSE (50% inférieurs) : ${accountType === 'brand' ? 'le produit mis en scène' : 'tous les éléments de la mission mis en scène ensemble'} selon la DIRECTION CRÉATIVE ci-dessus.
- Moitié HAUTE (50% supérieurs) : zone propice à l'incrustation de texte par-dessus (peu d'objets, peu de détails complexes), mais qui s'intègre naturellement à l'ambiance du bas (par exemple un fondu progressif de la matière/texture du bas vers une teinte calme en haut). Pas de mur uniforme déconnecté.

PALETTE de la scène (décor, lumière, fond) : ${palette}. ${accountType === 'brand' ? 'Le produit conserve ses couleurs réelles vues sur la référence.' : 'Chaque élément conserve ses couleurs réelles vues sur la référence ; seul le décor/fond suit la palette.'}

INTERDICTIONS STRICTES : aucun texte dans l'image, aucun logo, aucun caractère, aucun chiffre, aucune signature. Rendu photo/éditorial réaliste de qualité.`
}

// =========================================================
// Prompts texte (inchangé sauf injection 5 étoiles côté HTML pour 'avis')
// =========================================================
export function buildDocPrompts(
  brand: any,
  profile: any,
  operation: any,
  opts?: { dealText?: string | null; accountType?: AccountType },
): Record<string, string> {
  const accountType: AccountType = opts?.accountType === 'brand' ? 'brand' : 'freelance'
  const b = brand
  const o = operation
    ? [operation.name && `Opération: ${operation.name}`, operation.description && `Contexte: ${operation.description}`].filter(Boolean).join(' | ')
    : 'Prestation de services'

  const brandInfo = `Marque: ${b.brand_name || b.name} | Secteur: ${b.brand_sector} | Ton: ${b.brand_tone} | Description: ${b.brand_description || ''} | Valeurs: ${b.brand_values?.join(', ') || ''}`
  const issuerInfo = profile
    ? `Émetteur : ${[profile.full_name && `Nom: ${profile.full_name}`, profile.company_name && `Raison sociale: ${profile.company_name}`, profile.siret && `SIRET: ${profile.siret}`, profile.address && `Adresse: ${profile.address}`, (profile.postal_code || profile.city) && `${profile.postal_code || ''} ${profile.city || ''}`.trim(), profile.email_pro && `Email: ${profile.email_pro}`, profile.phone && `Tel: ${profile.phone}`].filter(Boolean).join(' | ')}`
    : ''

  const dealText = (opts?.dealText || operation?.deal_text || '').trim()
  const dealLine = dealText ? `Deal/Offre décrite par le freelance : ${dealText}.` : ''

  const htmlContract = `IMPORTANT: Output UNIQUEMENT du HTML brut, sans <html>, sans <body>, sans <style>, sans backticks, sans markdown. Balises autorisées: <h2>, <h3>, <p>, <strong>, <ul>, <ol>, <li>, <br>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. Le texte doit être prêt à être affiché dans un document brandé.`
  const mailContract = `IMPORTANT: Output UNIQUEMENT du HTML brut. Commence par <h2>Objet : …</h2> (l'objet sera utilisé pour pré-remplir le sujet d'un mail Gmail). Puis le corps en <p>. Pas de <html>, <body>, <style>, backticks, ni markdown. Balises autorisées: <h2>, <h3>, <p>, <strong>, <ul>, <ol>, <li>, <br>.`

  if (accountType === 'brand') {
    // ===== MODE BRAND : le document parle AU NOM de la marque scrapée =====
    return {
      facture: `Génère le CORPS HTML d'une facture professionnelle structurée avec <h2>Facture</h2>, un bloc émetteur/client en <p>, un tableau des prestations avec <table>, totaux HT/TVA/TTC en <p><strong>, conditions de paiement en <p>, mentions légales en fin. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Numéro FAC-2025-001, date du jour. ${htmlContract}`,
      remerciement: `Rédige le CORPS HTML d'une FICHE de remerciement post-achat ENVOYÉE AU NOM DE LA MARQUE ${b.brand_name || b.name} à ses clients. TRÈS PEU DE TEXTE — un titre court en <h2>, 1 à 2 phrases chaleureuses en <p> qui remercient le client d'avoir choisi la marque/son produit, et signe au nom de ${b.brand_name || b.name}. Un bloc 5 étoiles visuel sera ajouté automatiquement après ton texte, ne le mentionne pas. 40 mots maximum au total. ${brandInfo}. Contexte produit/service: ${o}. Ton ${b.brand_tone}. ${htmlContract}`,
      devis: `Génère le CORPS HTML d'un devis professionnel avec <h2>Devis</h2>, bloc émetteur/client, tableau désignations, montants HT/TVA/TTC en <strong>, validité 30j, zone signature. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Numéro DEV-2025-001, date du jour. ${htmlContract}`,
      relance: `Génère le CORPS HTML d'une fiche de RELANCE pour facture impayée, envoyée par la marque ${b.brand_name || b.name} à son client. <h2>Relance — Facture en attente</h2>, rappel courtois du contexte en <p>, tableau récap (numéro de facture, date d'émission, échéance dépassée, montant TTC) en <table>, modalités de paiement, ton ferme mais respectueux. ${brandInfo}. ${issuerInfo} Prestation: ${o}. Numéro REL-2025-001, date du jour, facture initiale supposée FAC-2025-001. ${htmlContract}`,
      nouveaute: `Rédige le CORPS HTML d'une fiche NOUVEAUTÉ produit présentée PAR la marque ${b.brand_name || b.name}. TRÈS COURT — l'image du produit est déjà affichée en gros au-dessus de ton texte, et le titre "NOUVEAUTÉ" est imprimé par le layout (ne le réécris pas). 2 à 4 phrases courtes en <p> qui présentent ce que la nouveauté apporte au client, avec un bénéfice clair, et un dernier <p> avec un appel à l'action (ex: "Découvrir →"). 50 mots maximum. Ne mets pas de <h2>. ${brandInfo}. Contexte du produit: ${o}. Ton ${b.brand_tone}. ${htmlContract}`,
      forfait: `Rédige le CORPS HTML d'une fiche FORFAIT/OFFRE proposée PAR la marque ${b.brand_name || b.name}. <h2>${dealText ? 'Notre offre' : 'Forfait sur mesure'}</h2>, présente le deal en <p>, puis détaille les éléments inclus en <ul>, mets le prix/conditions clés en <strong>, termine par les modalités d'engagement et un appel à l'action. ${dealLine} ${brandInfo}. Contexte: ${o}. Ton ${b.brand_tone}. ${htmlContract}`,

      mail_remerciement: `Rédige un mail de remerciement post-achat ENVOYÉ PAR LA MARQUE ${b.brand_name || b.name} à un client. ${mailContract} Un bloc 5 étoiles visuel sera ajouté automatiquement à la fin, invite poliment à laisser une note sans l'afficher en texte. ${brandInfo}. Contexte: ${o}. 100 mots max. Ton ${b.brand_tone}.`,
      mail_marketing: `Rédige un mail marketing PAR la marque ${b.brand_name || b.name}, personnalisé, qui s'appuie SUR LE CONTEXTE (produit, public, ambiance). ${mailContract} Accroche dès la 1ère phrase, présente le bénéfice clair, finis par un appel à l'action net. ${brandInfo}. Contexte: ${o}. 130 mots max. Ton ${b.brand_tone}.`,
    }
  }

  // ===== MODE FREELANCE : le document est envoyé PAR le freelance (profil)
  // À son client (la marque scrapée). Le document NE PRÉTEND PAS être la
  // marque cliente — c'est le freelance qui s'exprime, raconte sa mission,
  // et signe. La marque cliente n'est citée qu'en destinataire/contexte.
  // RÈGLE CLÉ : la marque scrapée ne sert QUE pour la charte visuelle
  // (couleurs/polices/registre de langue). Son catalogue, sa description
  // et ses valeurs sont volontairement IGNORÉS — seul compte le champ
  // "Mission" rempli par le freelance dans l'opération.
  // ============================================================
  const freelanceName = (profile?.company_name || profile?.full_name || 'le freelance').trim()
  const clientBrandName = b.brand_name || b.name || 'la marque cliente'
  const missionText = (operation?.description || '').trim()
  const missionName = (operation?.name || '').trim()
  const hasMission = missionText.length > 0 || missionName.length > 0

  // Mission encadrée en bloc explicite pour qu'elle se distingue visuellement
  // dans le prompt et ne soit pas noyée dans des champs marque. Si le freelance
  // n'a rien rempli, on dit explicitement au modèle qu'il n'a aucune info et
  // qu'il doit rester très générique (pas inventer la mission, ne PAS aller
  // chercher dans le catalogue de la marque).
  const missionInfo = hasMission
    ? `MISSION DU FREELANCE — SUJET UNIQUE DU DOCUMENT (priorité absolue, tout doit en découler) :
${missionName ? `Intitulé : ${missionName}` : ''}
${missionText ? `Description : ${missionText}` : ''}

Le texte que tu produis DOIT parler de cette mission et uniquement de cette mission. N'invente AUCUN détail qui n'y figure pas. Si une info manque (montant, durée, livrable précis), reste générique sur ce point au lieu de combler avec le catalogue de la marque cliente.`
    : `MISSION DU FREELANCE : le freelance n'a pas rempli de description de mission. Reste TRÈS générique ("prestation réalisée", "collaboration") — n'invente pas de détails, ne décris PAS les produits ni l'activité de ${clientBrandName}.`

  const voiceContract = `VOIX du document : c'est ${freelanceName} (freelance/prestataire) qui s'exprime à la 1re personne ("nous"/"je") et qui s'adresse à ${clientBrandName} (marque cliente, destinataire du document).
- INTERDIT : écrire comme si tu étais ${clientBrandName}, parler en son nom, présenter ses produits, vanter son catalogue, décrire son activité, mentionner son secteur ou ses valeurs.
- ${clientBrandName} apparaît UNIQUEMENT comme destinataire (ex: "Pour ${clientBrandName}", "Merci de votre confiance"). Tu ne sais RIEN de ${clientBrandName} en dehors de son nom — n'invente rien sur elle.
- Le sujet du texte est la MISSION ci-dessus, pas la marque.`

  const toneAlignment = `Niveau de langue : aligne-toi sur un registre ${b.brand_tone || 'professionnel'} pour la cohérence visuelle avec la charte du destinataire, sans pour autant te faire passer pour lui.`

  return {
    facture: `Génère le CORPS HTML d'une FACTURE émise PAR le freelance ${freelanceName} À ${clientBrandName}. Structure : <h2>Facture</h2>, bloc émetteur (freelance) et destinataire (${clientBrandName}) en <p>, tableau des prestations effectuées (basé sur la mission décrite) avec <table>, totaux HT/TVA/TTC en <p><strong>, conditions de paiement, mentions légales en fin. ${voiceContract} ${issuerInfo} Destinataire : ${clientBrandName}. ${missionInfo} Numéro FAC-2025-001, date du jour. ${htmlContract}`,
    remerciement: `Rédige le CORPS HTML d'une FICHE de remerciement envoyée PAR ${freelanceName} À ${clientBrandName} après la mission. Esprit "Merci d'être passé chez nous" / "Merci de votre confiance". TRÈS PEU DE TEXTE : un titre court en <h2> dans cet esprit, 1 à 2 phrases en <p> qui rappellent la mission effectuée et remercient le client de sa confiance. Signe au nom de ${freelanceName}. Un bloc 5 étoiles sera ajouté automatiquement, ne le mentionne pas. 40 mots maximum. ${voiceContract} ${missionInfo} ${toneAlignment} ${htmlContract}`,
    devis: `Génère le CORPS HTML d'un DEVIS envoyé PAR ${freelanceName} À ${clientBrandName} pour la mission décrite. <h2>Devis</h2>, bloc émetteur/destinataire, tableau désignations basé sur la mission, montants HT/TVA/TTC en <strong>, validité 30j, zone signature. ${voiceContract} ${issuerInfo} Destinataire : ${clientBrandName}. ${missionInfo} Numéro DEV-2025-001, date du jour. ${htmlContract}`,
    relance: `Génère le CORPS HTML d'une RELANCE envoyée PAR ${freelanceName} À ${clientBrandName} pour une facture impayée liée à la mission. <h2>Relance — Facture en attente</h2>, rappel courtois de la mission en <p>, tableau récap (numéro de facture, date d'émission, échéance dépassée, montant TTC), modalités de paiement, ton ferme mais respectueux. ${voiceContract} ${issuerInfo} Destinataire : ${clientBrandName}. ${missionInfo} Numéro REL-2025-001, date du jour, facture initiale supposée FAC-2025-001. ${htmlContract}`,
    nouveaute: `Rédige le CORPS HTML d'une fiche RÉALISATION présentée PAR ${freelanceName} à ${clientBrandName}, à propos du livrable de la mission. TRÈS COURT : l'image est déjà affichée en gros au-dessus de ton texte, et le titre est imprimé par le layout (ne le réécris pas). 2 à 4 phrases courtes en <p> qui présentent la réalisation/livraison, le résultat obtenu pour ${clientBrandName}, et un dernier <p> avec une invitation discrète (ex: "À très vite →"). 50 mots maximum. Ne mets pas de <h2>. ${voiceContract} ${missionInfo} ${toneAlignment} ${htmlContract}`,
    forfait: `Rédige le CORPS HTML d'une fiche OFFRE/FORFAIT proposée PAR ${freelanceName} À ${clientBrandName}. <h2>${dealText ? 'Notre proposition' : 'Proposition sur mesure'}</h2>, présente l'offre en <p>, détaille les éléments inclus en <ul>, mets le prix/conditions clés en <strong>, termine par les modalités et un appel à l'action. ${dealLine} ${voiceContract} ${issuerInfo} Destinataire : ${clientBrandName}. ${missionInfo} ${toneAlignment} ${htmlContract}`,

    mail_remerciement: `Rédige un MAIL de remerciement envoyé PAR ${freelanceName} À ${clientBrandName} après la mission. ${mailContract} Esprit "merci de votre confiance" sur la mission décrite. Un bloc 5 étoiles visuel sera ajouté automatiquement à la fin, invite poliment à laisser un retour sans l'afficher en texte. ${voiceContract} ${missionInfo} 100 mots max. ${toneAlignment}`,
    mail_marketing: `Rédige un MAIL adressé PAR ${freelanceName} À ${clientBrandName}, qui s'appuie sur la mission/contexte décrite ci-dessous pour proposer une suite ou un service complémentaire. ${mailContract} Accroche dès la 1ère phrase, mets en avant la valeur que le freelance peut apporter à ${clientBrandName}, finis par un appel à l'action net (ex: rdv, devis). ${voiceContract} ${missionInfo} 130 mots max. ${toneAlignment}`,
  }
}

export function sanitizeBody(text: string): string {
  return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
}
