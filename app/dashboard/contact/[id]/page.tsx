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
  const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false)
  const [showMoreData, setShowMoreData] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

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
    setShowReanalyzeConfirm(false)
    setAnalyzing(true)
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: contact.url, contactId: id })
    })
    const data = await res.json()
    setBrand(data)
    setContact({ ...contact, ...data })
    setAnalyzing(false)
  }

  const handleAnalyzeClick = () => {
    if (brand) {
      setShowReanalyzeConfirm(true)
    } else {
      handleAnalyze()
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    const res = await fetch('https://www.brandsheet.fr/api/gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: id })
    })
    const data = await res.json()
    if (data.success) {
      setGenerated(true)
      const { data: newDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
      if (newDocs) setDocs(newDocs)
    }
    setGenerating(false)
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
        .contact-header{padding:32px 44px 0;max-width:1200px;margin:0 auto;text-align:center;}
        .contact-title{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;margin-bottom:6px;}
        .contact-url{font-size:15px;color:#4A6280;font-style:italic;}
        .layout{display:grid;grid-template-columns:200px 240px 1fr;gap:20px;padding:24px 44px 44px;max-width:1200px;margin:0 auto;}
        .col{display:flex;flex-direction:column;gap:14px;}
        .panel{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:20px;}
        .panel-h{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;margin-bottom:14px;color:#6B84AA;font-style:italic;}
        .colors{display:flex;flex-wrap:wrap;gap:8px;}
        .color-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;}
        .color-chip{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;transition:transform .15s;}
        .color-chip:hover{transform:scale(1.1);}
        .color-hex{font-size:10px;color:#4A6280;font-family:monospace;}
        .font-item{font-size:13px;color:#6B84AA;font-style:italic;padding:5px 0;border-bottom:1px solid #0F1E3A;}
        .font-item:last-child{border-bottom:none;}
        .tone-badge{display:inline-block;background:#0D1B35;border:1px solid #0F2040;border-radius:20px;padding:5px 12px;font-size:12px;font-style:italic;color:#4F8EF7;margin-top:6px;}
        .action-btn{width:100%;padding:13px;border-radius:12px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;cursor:pointer;border:none;text-align:left;display:flex;align-items:center;gap:10px;transition:all .2s;margin-bottom:10px;}
        .action-btn:last-child{margin-bottom:0;}
        .action-primary{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;}
        .action-secondary{background:#0D1B35;border:1px solid #0F2040;color:#F0F4FF;}
        .action-secondary:hover{border-color:#4F8EF7;}
        .doc-item{background:#050B18;border:1px solid #0F1E3A;border-radius:10px;padding:11px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:border-color .2s;margin-bottom:8px;}
        .doc-item:last-child{margin-bottom:0;}
        .doc-item:hover{border-color:#4F8EF7;}
        .doc-item-left{display:flex;align-items:center;gap:10px;}
        .doc-icon{font-size:15px;color:#4F8EF7;}
        .doc-label{font-size:13px;font-style:italic;}
        .doc-status{font-size:11px;color:#4A6280;font-style:italic;}
        .doc-arrow{font-size:11px;color:#1E3050;}
        .main-panel{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:420px;text-align:center;}
        .main-panel-h{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;margin-bottom:10px;}
        .main-panel-p{color:#4A6280;font-size:15px;font-style:italic;margin-bottom:28px;max-width:300px;line-height:1.7;}
        .analyze-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:16px 32px;border-radius:12px;font-size:17px;font-family:'Playfair Display',serif;font-style:italic;border:none;cursor:pointer;}
        .analyzing-text{font-family:'Playfair Display',serif;font-size:20px;font-style:italic;color:#4A6280;animation:pulse 2s infinite;}
        .analyzing-sub{font-size:13px;color:#1E3050;margin-top:10px;font-style:italic;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        .brand-result{width:100%;text-align:left;}
        .brand-result-h{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:16px;}
        .brand-result-h em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;}
        .info-card{background:#050B18;border-radius:10px;padding:12px;}
        .info-label{font-size:11px;color:#4A6280;font-style:italic;margin-bottom:3px;}
        .info-value{font-size:14px;font-weight:500;}
        .generate-btn{width:100%;padding:15px;border-radius:12px;background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;font-family:'Playfair Display',serif;font-size:16px;font-style:italic;border:none;cursor:pointer;margin-top:20px;}
        .generate-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .more-btn{background:transparent;border:1px solid #0F1E3A;color:#4A6280;padding:8px 16px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:13px;font-style:italic;cursor:pointer;margin-top:14px;width:100%;}
        .more-btn:hover{border-color:#4A6280;color:#F0F4FF;}
        .more-data{margin-top:14px;background:#050B18;border-radius:10px;padding:14px;}
        .more-row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #0F1E3A;font-size:13px;}
        .more-row:last-child{border-bottom:none;}
        .more-label{color:#4A6280;font-style:italic;flex-shrink:0;margin-right:12px;}
        .more-value{color:#F0F4FF;text-align:right;}
        .values-wrap{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
        .value-tag{background:#0D1B35;border:1px solid #0F2040;border-radius:20px;padding:4px 10px;font-size:11px;font-style:italic;color:#4F8EF7;}
        .success-msg{text-align:center;padding:16px;background:#0A1F0A;border:1px solid #1A4A1A;border-radius:10px;margin-top:16px;font-size:14px;color:#4F8EF7;font-style:italic;}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;}
        .modal{background:#070F22;border:1px solid #0F2040;border-radius:20px;padding:36px;max-width:420px;width:90%;text-align:center;}
        .modal-h{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:10px;}
        .modal-p{color:#4A6280;font-size:15px;font-style:italic;margin-bottom:28px;line-height:1.7;}
        .modal-actions{display:flex;gap:12px;justify-content:center;}
        .modal-cancel{background:transparent;border:1px solid #0F2040;color:#4A6280;padding:11px 20px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;cursor:pointer;}
        .modal-confirm{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:11px 24px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;border:none;cursor:pointer;}
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
        <h1 className="contact-title">{contact.brand_name || contact.name}</h1>
        <p className="contact-url">{contact.url}</p>
      </div>

      <div className="layout">
        <div className="col">
          <div className="panel">
            <div className="panel-h">Palette</div>
            {brand?.brand_colors?.length > 0 ? (
              <div className="colors">
                {brand.brand_colors.map((c: string, i: number) => (
                  <div key={i} className="color-wrap">
                    <div className="color-chip" style={{background: c}} title={c}></div>
                    <div className="color-hex">{c}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{fontSize:12,color:'#1E3050',fontStyle:'italic'}}>Lancez l'analyse</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-h">Polices</div>
            {brand?.brand_fonts?.length > 0 && brand.brand_fonts[0] !== null ? (
              brand.brand_fonts.map((f: string, i: number) => (
                <div key={i} className="font-item">{f}</div>
              ))
            ) : (
              <p style={{fontSize:12,color:'#1E3050',fontStyle:'italic'}}>Non détectées</p>
            )}
            {brand?.brand_tone && (
              <div style={{marginTop:12}}>
                <div className="panel-h">Ton</div>
                <span className="tone-badge">{brand.brand_tone}</span>
              </div>
            )}
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-h">Actions</div>
            <button className="action-btn action-primary" onClick={handleAnalyzeClick} disabled={analyzing}>
              <span>✦</span>
              {analyzing ? 'Analyse...' : brand ? 'Ré-analyser' : "Lancer l'analyse"}
            </button>
            <button className="action-btn action-secondary">
              <span>+</span> Ajouter une commande
            </button>
          </div>

          <div className="panel">
            <div className="panel-h">Mes documents</div>
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

        <div className="col">
          <div className="main-panel">
            {analyzing ? (
              <div>
                <p className="analyzing-text">L'IA analyse le site...</p>
                <p className="analyzing-sub">Couleurs, typographies, ton éditorial</p>
              </div>
            ) : brand ? (
              <div className="brand-result">
                <h2 className="brand-result-h">Branding <em>détecté</em></h2>
                <div className="colors">
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
                  <div className="info-card">
                    <div className="info-label">Typographies</div>
                    <div className="info-value">{brand.brand_fonts?.filter(Boolean).join(', ') || '—'}</div>
                  </div>
                  <div className="info-card">
                    <div className="info-label">Marque</div>
                    <div className="info-value">{brand.brand_name || '—'}</div>
                  </div>
                </div>

                {brand.brand_values?.length > 0 && (
                  <div className="values-wrap">
                    {brand.brand_values.map((v: string, i: number) => (
                      <span key={i} className="value-tag">{v}</span>
                    ))}
                  </div>
                )}

                <button className="more-btn" onClick={() => setShowMoreData(!showMoreData)}>
                  {showMoreData ? '▲ Moins de données' : '▼ Voir plus de données'}
                </button>

                {showMoreData && (
                  <div className="more-data">
                    {brand.brand_description && (
                      <div className="more-row">
                        <span className="more-label">Description</span>
                        <span className="more-value">{brand.brand_description}</span>
                      </div>
                    )}
                    {brand.brand_email && (
                      <div className="more-row">
                        <span className="more-label">Email</span>
                        <span className="more-value">{brand.brand_email}</span>
                      </div>
                    )}
                    {brand.brand_phone && (
                      <div className="more-row">
                        <span className="more-label">Téléphone</span>
                        <span className="more-value">{brand.brand_phone}</span>
                      </div>
                    )}
                    {brand.brand_address && (
                      <div className="more-row">
                        <span className="more-label">Adresse</span>
                        <span className="more-value">{brand.brand_address}</span>
                      </div>
                    )}
                  </div>
                )}

                {generated && (
                  <div className="success-msg">✦ Tous les documents ont été générés !</div>
                )}

                <button className="generate-btn" onClick={handleGenerate} disabled={generating}>
                  {generating ? '⏳ Génération en cours...' : '✦ Générer tous les documents →'}
                </button>
              </div>
            ) : (
              <>
                <h2 className="main-panel-h">Analysez le branding</h2>
                <p className="main-panel-p">L'IA va analyser le site de votre client et extraire sa palette, ses polices et son identité.</p>
                <button className="analyze-btn" onClick={handleAnalyze}>✦ Lancer l'analyse →</button>
              </>
            )}
          </div>
        </div>
      </div>

      {showReanalyzeConfirm && (
        <div className="modal-overlay" onClick={() => setShowReanalyzeConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-h">Ré-analyser ?</h2>
            <p className="modal-p">Le branding actuel sera remplacé par la nouvelle analyse. Les documents déjà générés ne seront pas affectés.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowReanalyzeConfirm(false)}>Annuler</button>
              <button className="modal-confirm" onClick={handleAnalyze}>Confirmer →</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}