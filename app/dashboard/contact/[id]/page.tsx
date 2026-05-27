'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function ContactPage() {
  const { id } = useParams()
  const [contact, setContact] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [brand, setBrand] = useState<any>(null)

  useEffect(() => {
    supabase.from('contacts').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setContact(data)
        if (data.brand_colors) setBrand(data)
      }
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
        .body{max-width:900px;margin:0 auto;padding:60px 24px;}
        .contact-title{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;margin-bottom:8px;}
        .contact-url{font-size:16px;color:#4A6280;font-style:italic;margin-bottom:40px;}
        .analyze-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:16px 32px;border-radius:12px;font-size:18px;font-family:'Cormorant Garamond',serif;font-style:italic;border:none;cursor:pointer;margin-bottom:40px;}
        .analyzing{text-align:center;padding:60px;}
        .analyzing-text{font-family:'Playfair Display',serif;font-size:24px;font-style:italic;color:#4A6280;animation:pulse 2s infinite;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        .brand-section{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:32px;margin-bottom:24px;}
        .brand-section-h{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:20px;}
        .colors{display:flex;gap:12px;flex-wrap:wrap;}
        .color-chip{width:48px;height:48px;border-radius:10px;border:1px solid #0F2040;}
        .color-label{font-size:12px;color:#4A6280;font-style:italic;margin-top:6px;text-align:center;}
        .color-wrap{display:flex;flex-direction:column;align-items:center;}
        .brand-info{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .brand-info-item{background:#050B18;border-radius:10px;padding:16px;}
        .brand-info-label{font-size:12px;color:#4A6280;font-style:italic;margin-bottom:6px;}
        .brand-info-value{font-size:16px;font-weight:500;}
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => window.location.href='/dashboard'}>← Retour</button>
      </nav>

      <div className="body">
        <h1 className="contact-title">{contact.name}</h1>
        <p className="contact-url">{contact.url}</p>

        {!brand && !analyzing && (
          <button className="analyze-btn" onClick={handleAnalyze}>
            ✦ Analyser le branding →
          </button>
        )}

        {analyzing && (
          <div className="analyzing">
            <p className="analyzing-text">L'IA analyse le site de votre client...</p>
          </div>
        )}

        {brand && brand.brand_colors && (
          <>
            <div className="brand-section">
              <h2 className="brand-section-h">Palette détectée</h2>
              <div className="colors">
                {brand.brand_colors.map((c: string, i: number) => (
                  <div key={i} className="color-wrap">
                    <div className="color-chip" style={{background: c}}></div>
                    <div className="color-label">{c}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="brand-section">
              <h2 className="brand-section-h">Identité de marque</h2>
              <div className="brand-info">
                <div className="brand-info-item">
                  <div className="brand-info-label">Ton éditorial</div>
                  <div className="brand-info-value">{brand.brand_tone}</div>
                </div>
                <div className="brand-info-item">
                  <div className="brand-info-label">Secteur</div>
                  <div className="brand-info-value">{brand.brand_sector}</div>
                </div>
                <div className="brand-info-item">
                  <div className="brand-info-label">Typographies</div>
                  <div className="brand-info-value">{brand.brand_fonts?.join(', ')}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}