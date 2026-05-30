'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CREDIT_PACKS, type CreditPack } from '@/lib/plans'

export default function CreditsPage() {
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [loadingPack, setLoadingPack] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login'
        return
      }
      setUser(data.user)
      supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: c }) => setCredits(c?.credits ?? 0))
    })
  }, [])

  const handleBuy = async (pack: CreditPack) => {
    setLoadingPack(pack.id)
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        window.location.href = '/login'
        return
      }
      const res = await fetch('/api/stripe/credits-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id, userId: data.user.id }),
      })
      const payload = await res.json()
      if (!res.ok) {
        alert(payload.message || payload.error || 'Erreur Stripe — voir SETUP_STRIPE.md')
        return
      }
      if (payload.url) {
        window.location.href = payload.url
        return
      }
      alert('Aucune URL Stripe renvoyée.')
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingPack(null)
    }
  }

  if (!user) return null

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
        .body{max-width:900px;margin:0 auto;padding:60px 24px;text-align:center;}
        .h1{font-family:'Playfair Display',serif;font-size:34px;font-weight:700;margin-bottom:8px;}
        .h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .sub{color:#4A6280;font-style:italic;margin-bottom:36px;}
        .balance{display:inline-block;background:#070F22;border:1px solid #0F2040;border-radius:14px;padding:18px 28px;margin-bottom:44px;}
        .balance-label{font-size:13px;color:#6B84AA;font-style:italic;margin-bottom:4px;}
        .balance-value{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:32px;}
        @media(max-width:760px){.grid{grid-template-columns:1fr;}}
        .pack{background:#070F22;border:1px solid #0F2040;border-radius:18px;padding:30px 24px;text-align:center;position:relative;transition:border-color .2s;}
        .pack:hover{border-color:#4F8EF7;}
        .pack-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;font-size:11px;padding:4px 12px;border-radius:20px;font-style:italic;}
        .pack-h{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:8px;}
        .pack-credits{font-size:15px;color:#6B84AA;font-style:italic;margin-bottom:18px;}
        .pack-price{font-family:'Playfair Display',serif;font-size:38px;font-weight:700;margin-bottom:4px;}
        .pack-price em{font-size:16px;font-style:italic;color:#4A6280;font-weight:400;}
        .pack-rate{font-size:12px;color:#1E3050;font-style:italic;margin-bottom:22px;}
        .pack-btn{width:100%;padding:13px;border-radius:10px;background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;border:none;cursor:pointer;}
        .pack-btn:disabled{opacity:.6;cursor:not-allowed;}
        .hint{color:#1E3050;font-size:13px;font-style:italic;margin-top:10px;}
        .legend{margin-top:36px;font-size:13px;color:#4A6280;font-style:italic;line-height:1.8;}
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => (window.location.href = '/dashboard')}>← Mes contacts</button>
      </nav>

      <div className="body">
        <h1 className="h1">Recharger en <em>crédits</em></h1>
        <p className="sub">Génération à la carte : <strong style={{color:'#A8C8FC',fontWeight:500,fontStyle:'normal'}}>2 crédits par document</strong>. Une régénération coûte <strong style={{color:'#A8C8FC',fontWeight:500,fontStyle:'normal'}}>2 crédits</strong>.</p>

        <div className="balance">
          <div className="balance-label">Solde actuel</div>
          <div className="balance-value">{credits ?? '…'} crédits</div>
        </div>

        <div className="grid">
          {CREDIT_PACKS.map((p) => (
            <div key={p.id} className="pack">
              {p.tag && <div className="pack-tag">{p.tag}</div>}
              <div className="pack-h">{p.label}</div>
              <div className="pack-credits">{p.credits} crédits</div>
              <div className="pack-price">{p.price}<em>€</em></div>
              <div className="pack-rate">≈ {(p.price / p.credits).toFixed(2)}€ / crédit</div>
              <button className="pack-btn" disabled={loadingPack === p.id} onClick={() => handleBuy(p)}>
                {loadingPack === p.id ? 'Redirection…' : 'Acheter →'}
              </button>
            </div>
          ))}
        </div>

        <p className="legend">
          ✦ Paiement sécurisé via Stripe (à venir). Les crédits sont valables à vie et utilisables sur tous vos contacts.
        </p>
      </div>
    </>
  )
}
