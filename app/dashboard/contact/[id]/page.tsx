'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function ContactPage() {
  const { id } = useParams()
  const [contact, setContact] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [brand, setBrand] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])

  useEffect(() => {
    supabase.from('contacts').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setContact(data)
        if (data.brand_colors) setBrand(data)
      }
    })
    supabase.from('documents').select('*').eq('contact_id', id).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setDocs(data)
    })
  }, [id])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: contact.url, contactId: id })
    })
    const data = await res.json()
    setBrand(data)
    setAnalyzing(false)
  }

  if (!contact) return null

  const docTypes = [
    { key: 'bienvenue', label: 'Mail bienvenue', icon: '✉' },
    { key: 'remerciement', label: 'Remerciement', icon: '✦' },
    { key: 'avis', label: 'Demande avis', icon: '★' },
    { key: 'facture', label: 'Facture', icon: '◈' },
    { key: 'devis', label: 'Devis', icon: '◇' },
    { key: 'cgv', label: 'CGV', icon: '⊞' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Cormorant Garamond',serif;background:#050B18;color:#F0F4FF;}
        .nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid #0F1E3A;}
        .logo{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .back{font-size:14px;color:#4A6280;font-style:italic;cursor:pointer;background:none;border:none;font-family:'Cormorant Garamond',serif;}
        .back:hover{color:#F0F4FF;}
        .contact-header{padding:32px 44px 0;max-width:1200px;margin:0 auto;}
        .contact-title{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;margin-bottom:6px;}
        .contact-url{font-size:15px;color:#4A6280;font-style:italic;}
        .layout{display:grid;grid-template-columns:200px 220px 1fr;gap:20px;padding:24px 44px 44px;max-width:1200px;margin:0 auto;}
        .col{display:flex;flex-direction:column;gap:14px;}
        .panel{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:20px;}
        .panel-h{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;margin-bottom:14px;color:#6B84AA;font-style:italic;}
        .colors{display:flex;flex-wrap:wrap;gap:8px;}
        .color-chip{width:36px;height:36px;border-radius:8px;border:1px solid #0F2040;}
        .color-hex{font-size:10px;color:#4A6280;margin-top:4px;text-align:center;}
        .color-wrap{display:flex;flex-direction:column;align-items:center;}
        .font-item{font-size:14px;color:#6B84AA;font-style:italic;padding:6px 0;border-bottom:1px solid #0F1E3A;}
        .font-item:last-child{border-bottom:none;}
        .tone-badge{display:inline-block;background:#0D1B35;border:1px solid #0F2040;border-radius:20px;padding:6px 14px;font-size:13px;font-style:italic;color:#4F8EF7;margin-top:4px;}
        .action-btn{width:100%;padding:14px;border-radius:12px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;cursor:pointer;border:none;text-align:left;display:flex;align-items:center;gap:10px;transition:all .2s;}
        .action-btn-primary{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;}
        .action-btn-secondary{background:#0D1B35;border:1px solid #0F2040;color:#F0F4FF;}
        .action-btn-secondary:hover{border-color:#4F8EF7;}
        .doc-list{display:flex;flex-direction:column;gap:8px;}
        .doc-item{background:#050B18;border:1px solid #0F1E3A;border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:border-color .2s;}
        .doc-item:hover{border-color:#4F8EF7;}
        .doc-item-left{display:flex;align-items:center;gap:10px;}
        .doc-icon{font-size:16px;color:#4F8EF7;}
        .doc-label{font-size:14px;font-style:italic;}
        .doc-status{font-size:11px;color:#4A6280;font-style:italic;}
        .doc-arrow{font-size:12px;color:#1E3050;}
        .main-panel{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;text-align:center;}
        .main-panel-h{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;margin-bottom:12px;}
        .main-panel-p{color:#4A6280;font-size:16px;font-style:italic;margin-bottom:32px;max-width:320px;}
        .analyze-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:18px 36px;border-radius:14px;font-size:18px;font-family:'Playfair Display',serif;font-style:italic;border:none;cursor:pointer;}
        .analyzing-wrap{text-align:center;}
        .analyzing-text{font-family:'Playfair Display',serif;font-size:22px;font-style:italic;color:#4A6280;animation:pulse 2s infinite;}
        .analyzing-sub{font-size:14px;color:#1E3050;margin-top:12px;font-style:italic;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        .brand-result{width:100%;text-align:left;}
        .brand-result-h{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:20px;}
        .brand-result-h em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px;}
        .info-card{background:#050B18;border-radius:10px;padding:14px;}
        .info-label{font-size:12px;color:#4A6280;font-style:italic;margin-bottom:4px;}
        .info-value{font-size:15px;font-weight:500;}
        .generate-all-btn{width:100%;padding:16px;border-radius:12px;background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;font-family:'Playfair Display',serif;font-size:17px;font-style:italic;border:none;cursor:pointer;margin-top:24px;}
        @media(max-width:768px){
          .layout{grid-template-columns:1fr;padding:16px 20px;}
          .contact-header{padding:24px 20px 0;}
          .nav{padding:16px 20px;}
        }
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => window.location.href='/dashboard'}>← Mes contacts</button>
      </nav>

      <div className="contact-header">
        <h1 className="contact-title">{contact.name}</h1>
        <p className="contact-url">{contact.url}</p>
      </div>

      <div className="layout">
        {/* Colonne gauche — Branding */}
        <div className="col">
          <div className="panel">
            <div className="panel-h">Palette</div>
            {brand?.brand_colors ? (
              <div className="colors">
                {brand.brand_colors.map((c: string, i: number) => (
                  <div key={i} className="color-wrap">
                    <div className="color-chip" style={{background: c}}></div>
                    <div className="color-hex">{c}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{fontSize:13,color:'#1E3050',fontStyle:'italic'}}>Lancez l'analyse pour détecter la palette</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-h">Polices</div>
            {brand?.brand_fonts ? (
              <div>
                {brand.brand_fonts.map((f: string, i: number) => (
                  <div key={i} className="font-item">{f}</div>
                ))}
              </div>
            ) : (
              <p style={{fontSize:13,color:'#1E3050',fontStyle:'italic'}}>Aucune police détectée</p>
            )}
            {brand?.brand_tone && (
              <div style={{marginTop:12}}>
                <div className="panel-h">Ton</div>
                <span className="tone-badge">{brand.brand_tone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Colonne centre — Actions + Docs */}
        <div className="col">
          <div className="panel">
            <div className="panel-h">Actions</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <button className="action-btn action-btn-primary" onClick={handleAnalyze} disabled={analyzing}>
                <span>✦</span>
                {analyzing ? 'Analyse...' : brand ? 'Ré-analyser' : 'Lancer l\'analyse'}
              </button>
              <button className="action-btn action-btn-secondary">
                <span>+</span> Ajouter une commande
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">Mes documents</div>
            <div className="doc-list">
              {docTypes.map((dt) => {
                const doc = docs.find(d => d.type === dt.key)
                return (
                  <div key={dt.key} className="doc-item">
                    <div className="doc-item-left">
                      <span className="doc-icon">{dt.icon}</span>
                      <div>
                        <div className="doc-label">{dt.label}</div>
                        <div className="doc-status">{doc ? '✓ Généré' : 'Non généré'}</div>
                      </div>
                    </div>
                    <span className="doc-arrow">→</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Zone principale */}
        <div className="col">
          <div className="main-panel">
            {analyzing ? (
              <div className="analyzing-wrap">
                <p className="analyzing-text">L'IA analyse le site de votre client...</p>
                <p className="analyzing-sub">Détection des couleurs, typographies, ton éditorial</p>
              </div>
            ) : brand ? (
              <div className="brand-result">
                <h2 className="brand-result-h">Branding <em>détecté</em></h2>
                <div className="colors" style={{marginBottom:16}}>
                  {brand.brand_colors?.map((c: string, i: number) => (
                    <div key={i} className="color-wrap">
                      <div className="color-chip" style={{background: c, width:44, height:44}}></div>
                      <div className="color-hex">{c}</div>
                    </div>
                  ))}
                </div>
                <div className="info-grid">
                  <div className="info-card">
                    <div className="info-label">Secteur</div>
                    <div className="info-value">{brand.brand_sector || '—'}</div>
                  </div>
                  <div className="info-card">
                    <div className="info-label">Ton éditorial</div>
                    <div className="info-value">{brand.brand_tone || '—'}</div>
                  </div>
                  <div className="info-card" style={{gridColumn:'1/-1'}}>
                    <div className="info-label">Typographies</div>
                    <div className="info-value">{brand.brand_fonts?.join(', ') || '—'}</div>
                  </div>
                </div>
                <button className="generate-all-btn">✦ Générer tous les documents →</button>
              </div>
            ) : (
              <>
                <h2 className="main-panel-h">Analysez le branding</h2>
                <p className="main-panel-p">L'IA va analyser le site de votre client et extraire sa palette, ses polices et son ton éditorial.</p>
                <button className="analyze-btn" onClick={handleAnalyze}>✦ Lancer l'analyse →</button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}