'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CREDIT_PACKS, type CreditPack } from '@/lib/plans'

export default function CreditsPage() {
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [loadingPack, setLoadingPack] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let kicked = false

    const onLoggedIn = async (authUser: any) => {
      if (!mounted) return
      setUser(authUser)
      const { data: c } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (!mounted) return
      if (c) {
        setCredits(c.credits)
      } else {
        // Fallback : ligne absente (trigger init_user_credits pas joué).
        // user_id seul est autorisé à l'INSERT côté client (column-grant RLS),
        // 'credits' prend sa valeur via le default 20.
        await supabase.from('user_credits').insert({ user_id: authUser.id })
        if (mounted) setCredits(20)
      }
    }

    // Même pattern que /dashboard : getSession() (sync localStorage, pas de
    // round-trip réseau) + onAuthStateChange. getUser() seul était fragile —
    // si la session n'est pas encore propagée, la query restait pending et
    // l'UI restait bloquée sur "… crédits".
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session?.user) {
        onLoggedIn(data.session.user)
      } else {
        setTimeout(() => {
          if (!mounted || kicked || user) return
          kicked = true
          window.location.href = '/login'
        }, 1200)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session?.user) onLoggedIn(session.user)
    })

    return () => { mounted = false; sub.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        body{font-family:'Cormorant Garamond',serif;background:var(--bg-deep);color:var(--text-strong);}
        .nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid var(--border-1);}
        .logo{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .back{font-size:14px;color:var(--text-muted);font-style:italic;cursor:pointer;background:none;border:none;font-family:'Cormorant Garamond',serif;}
        .back:hover{color:var(--text-strong);}
        .body{max-width:900px;margin:0 auto;padding:60px 24px;text-align:center;}
        .h1{font-family:'Playfair Display',serif;font-size:34px;font-weight:700;margin-bottom:8px;}
        .h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .sub{color:var(--text-muted);font-style:italic;margin-bottom:36px;}
        .balance{display:inline-block;background:var(--bg-elev);border:1px solid var(--border-2);border-radius:14px;padding:18px 28px;margin-bottom:44px;}
        .balance-label{font-size:13px;color:var(--text-mid);font-style:italic;margin-bottom:4px;}
        .balance-value{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;}
        @media(max-width:1100px){.grid{grid-template-columns:repeat(3,1fr);}}
        @media(max-width:820px){.grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:520px){.grid{grid-template-columns:1fr;}}
        .pack{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:16px;padding:22px 18px;text-align:center;position:relative;transition:border-color .2s, transform .15s;}
        .pack:hover{border-color:#4F8EF7;transform:translateY(-2px);}
        .pack-popular{border-color:#7C3AED;box-shadow:0 0 0 1px rgba(124,58,237,0.25);}
        .pack-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;font-size:10px;padding:4px 10px;border-radius:20px;font-style:italic;white-space:nowrap;letter-spacing:.3px;}
        .pack-h{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;margin-bottom:6px;}
        .pack-credits{font-family:'Playfair Display',serif;font-size:30px;font-weight:700;line-height:1;color:var(--link-soft);margin-bottom:2px;}
        .pack-credits-label{font-size:12px;color:var(--text-mid);font-style:italic;margin-bottom:14px;letter-spacing:.5px;}
        .pack-price{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;margin-bottom:2px;}
        .pack-price em{font-size:14px;font-style:italic;color:var(--text-muted);font-weight:400;}
        .pack-rate{font-size:11px;color:var(--text-faint);font-style:italic;margin-bottom:18px;}
        .pack-btn{width:100%;padding:11px;border-radius:9px;background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;border:none;cursor:pointer;}
        .pack-btn:disabled{opacity:.6;cursor:not-allowed;}
        .hint{color:var(--text-faint);font-size:13px;font-style:italic;margin-top:10px;}
        .legend{margin-top:36px;font-size:13px;color:var(--text-muted);font-style:italic;line-height:1.8;}
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => (window.location.href = '/dashboard')}>← Mes contacts</button>
      </nav>

      <div className="body">
        <h1 className="h1">Recharger en <em>crédits</em></h1>
        <p className="sub">Génération à la carte : <strong style={{color:'var(--link-soft)',fontWeight:500,fontStyle:'normal'}}>4 crédits par document</strong> (8 en qualité premium). Une régénération coûte <strong style={{color:'var(--link-soft)',fontWeight:500,fontStyle:'normal'}}>2 crédits</strong>.</p>

        <div className="balance">
          <div className="balance-label">Solde actuel</div>
          <div className="balance-value">{credits ?? '…'} crédits</div>
        </div>

        <div className="grid">
          {CREDIT_PACKS.map((p) => {
            const priceStr = p.price.toFixed(2).replace('.', ',')
            const creditsPerEuro = (p.credits / p.price).toFixed(1).replace('.', ',')
            return (
              <div key={p.id} className={`pack${p.tag ? ' pack-popular' : ''}`}>
                {p.tag && <div className="pack-tag">{p.tag}</div>}
                <div className="pack-h">{p.label}</div>
                <div className="pack-credits">{p.credits}</div>
                <div className="pack-credits-label">CRÉDITS</div>
                <div className="pack-price">{priceStr}<em> €</em></div>
                <div className="pack-rate">{creditsPerEuro} crédits / €</div>
                <button className="pack-btn" disabled={loadingPack === p.id} onClick={() => handleBuy(p)}>
                  {loadingPack === p.id ? 'Redirection…' : 'Acheter →'}
                </button>
              </div>
            )
          })}
        </div>

        <p className="legend">
          ✦ Paiement sécurisé via Stripe (à venir). Les crédits sont valables à vie et utilisables sur tous vos contacts.
        </p>
      </div>
    </>
  )
}
