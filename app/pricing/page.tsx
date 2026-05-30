'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PLANS, PLAN_ORDER, PlanId, BillingCycle, formatEUR } from '@/lib/plans'

export default function PricingPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PlanId>('starter')
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      if (!user) {
        setLoggedIn(false)
        return
      }
      setLoggedIn(true)
      supabase.from('profiles').select('plan').eq('user_id', user.id).maybeSingle().then(({ data: p }) => {
        if (p?.plan && p.plan in PLANS) setCurrentPlan(p.plan as PlanId)
      })
    })
  }, [])

  const handleChoose = async (planId: PlanId) => {
    if (loggedIn === false) {
      window.location.href = '/login'
      return
    }
    if (planId === currentPlan || planId === 'starter') return
    setBusyPlan(planId)
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        window.location.href = '/login'
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cycle, userId: data.user.id }),
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
      setBusyPlan(null)
    }
  }

  const ctaLabel = (planId: PlanId) => {
    if (loggedIn === false) return planId === 'starter' ? 'Créer un compte' : 'S\'inscrire pour choisir'
    if (planId === currentPlan) return 'Plan actuel'
    return `Choisir ${PLANS[planId].label}`
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Cormorant Garamond',serif;background:#050B18;color:#F0F4FF;}
        .nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid #0F1E3A;}
        .logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;cursor:pointer;text-decoration:none;}
        .nav-right{display:flex;gap:24px;align-items:center;}
        .nav-link{color:#4A6280;font-size:15px;text-decoration:none;font-style:italic;cursor:pointer;background:none;border:none;font-family:'Cormorant Garamond',serif;}
        .nav-link:hover{color:#F0F4FF;}
        .btn-nav{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff!important;padding:11px 22px;border-radius:8px;font-size:14px;text-decoration:none;}

        .body{max-width:1100px;margin:0 auto;padding:80px 24px 60px;text-align:center;}
        .eyebrow{font-size:13px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#4F8EF7;margin-bottom:16px;font-style:italic;}
        .h1{font-family:'Playfair Display',serif;font-size:54px;font-weight:700;line-height:1.1;margin-bottom:14px;letter-spacing:-1px;}
        .h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .sub{font-size:19px;color:#4A6280;font-style:italic;line-height:1.7;max-width:540px;margin:0 auto 14px;}
        .current{display:inline-flex;align-items:center;gap:8px;background:#070F22;border:1px solid #1E3A5F;border-radius:30px;padding:8px 18px;margin-top:18px;font-size:13px;color:#A8C8FC;font-style:italic;}
        .current-dot{width:7px;height:7px;border-radius:50%;background:#4F8EF7;}

        .plans{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:50px;text-align:left;}
        .plan{background:#070F22;border:1px solid #0F2040;border-radius:18px;padding:32px 24px;position:relative;display:flex;flex-direction:column;transition:transform .2s, border-color .2s;}
        .plan:hover{transform:translateY(-3px);border-color:#1E3A5F;}
        .plan-pop{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4F8EF7,#7C3AED);font-size:11px;font-style:italic;color:#fff;padding:6px 18px;border-radius:20px;white-space:nowrap;letter-spacing:.5px;}
        .plan-hot{border:1.5px solid #4F8EF7;box-shadow:0 0 0 4px rgba(79,142,247,0.08);}
        .plan-current{border:1.5px solid #28C840;}
        .plan-current-tag{position:absolute;top:-13px;right:14px;background:#28C840;color:#fff;font-size:11px;font-style:italic;padding:5px 12px;border-radius:20px;}
        .plan-tier{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:6px;}
        .plan-tagline{font-size:13px;color:#4A6280;font-style:italic;margin-bottom:18px;min-height:18px;}
        .plan-price{font-family:'Playfair Display',serif;font-size:42px;font-weight:700;line-height:1;margin-bottom:4px;}
        .plan-mo{font-size:15px;color:#4A6280;font-style:italic;margin-bottom:6px;}
        .plan-billed{font-size:12px;color:#6B84AA;font-style:italic;line-height:1.5;margin-bottom:14px;min-height:32px;}
        .plan-billed strong{color:#A8C8FC;font-weight:500;}
        .plan-save{display:inline-block;background:rgba(40,200,64,0.12);color:#28C840;border:1px solid rgba(40,200,64,0.35);border-radius:14px;padding:2px 10px;font-size:11px;font-style:italic;margin-left:6px;letter-spacing:.3px;}

        .cycle-wrap{display:inline-flex;align-items:center;gap:14px;background:#070F22;border:1px solid #0F2040;border-radius:30px;padding:6px 8px;margin-top:24px;}
        .cycle-label{font-size:13px;color:#4A6280;font-style:italic;padding:0 6px;cursor:pointer;user-select:none;transition:color .2s;}
        .cycle-label-active{color:#F0F4FF;}
        .cycle-switch{position:relative;width:46px;height:24px;background:#0D1B35;border-radius:14px;border:1px solid #1E3A5F;cursor:pointer;transition:background .2s;flex-shrink:0;}
        .cycle-switch-on{background:linear-gradient(135deg,#4F8EF7,#7C3AED);border-color:transparent;}
        .cycle-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s;}
        .cycle-knob-on{transform:translateX(22px);}
        .cycle-badge{font-size:11px;font-style:italic;color:#28C840;background:rgba(40,200,64,0.1);border:1px solid rgba(40,200,64,0.3);border-radius:14px;padding:3px 10px;letter-spacing:.3px;}
        .plan-credits{font-size:14px;font-style:italic;color:#A8C8FC;margin:0 0 14px;padding:12px 0;border-top:1px solid #0F1E3A;border-bottom:1px solid #0F1E3A;}
        .feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:24px;padding:0;flex-grow:1;}
        .feats li{font-size:14px;color:#A8C8FC;display:flex;gap:9px;align-items:flex-start;font-style:italic;line-height:1.5;}
        .feats li::before{content:"✓";color:#4F8EF7;font-weight:700;font-style:normal;flex-shrink:0;}
        .cta{width:100%;padding:13px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:500;font-style:italic;cursor:pointer;border:none;transition:opacity .2s;}
        .cta:disabled{opacity:.6;cursor:not-allowed;}
        .cta-outline{background:transparent;border:1px solid #1E3A5F;color:#F0F4FF;}
        .cta-outline:hover:not(:disabled){border-color:#4F8EF7;}
        .cta-filled{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;}
        .cta-current{background:#0D1B35;color:#4A6280;cursor:default;border:1px dashed #1E3A5F;}

        .legend{margin-top:48px;color:#4A6280;font-size:14px;font-style:italic;line-height:1.9;max-width:680px;margin-left:auto;margin-right:auto;}
        .legend strong{color:#A8C8FC;font-weight:500;}
        .footer{padding:30px 44px;border-top:1px solid #0A1428;text-align:center;color:#1E3050;font-size:13px;font-style:italic;}

        @media (max-width:1024px){.plans{grid-template-columns:repeat(2,1fr);}}
        @media (max-width:640px){
          .nav{padding:16px 20px;}
          .nav-right{gap:12px;}
          .body{padding:50px 18px 40px;}
          .h1{font-size:38px;}
          .sub{font-size:16px;}
          .plans{grid-template-columns:1fr;gap:22px;margin-top:40px;}
        }
      `}</style>

      <nav className="nav">
        <a href="/" className="logo">BrandSheet</a>
        <div className="nav-right">
          {loggedIn ? (
            <>
              <a href="/dashboard" className="nav-link">Mes contacts</a>
              <a href="/dashboard/credits" className="nav-link">Crédits</a>
            </>
          ) : (
            <>
              <a href="/" className="nav-link">Accueil</a>
              <a href="/login" className="btn-nav">Connexion</a>
            </>
          )}
        </div>
      </nav>

      <div className="body">
        <div className="eyebrow">Tarifs</div>
        <h1 className="h1">Choisissez votre <em>plan</em>.</h1>
        <p className="sub">Sans engagement. Annulez à tout moment. Les crédits sont rechargés chaque mois.</p>
        {loggedIn && (
          <div className="current">
            <span className="current-dot"></span>
            Plan actuel : <strong style={{color:'#F0F4FF',fontStyle:'normal',marginLeft:4}}>{PLANS[currentPlan].label}</strong>
          </div>
        )}

        <div style={{marginTop:24,display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
          <div className="cycle-wrap" role="group" aria-label="Cycle de facturation">
            <span
              className={`cycle-label${cycle === 'monthly' ? ' cycle-label-active' : ''}`}
              onClick={() => setCycle('monthly')}
            >Mensuel</span>
            <button
              type="button"
              aria-pressed={cycle === 'annual'}
              aria-label="Basculer en facturation annuelle"
              className={`cycle-switch${cycle === 'annual' ? ' cycle-switch-on' : ''}`}
              onClick={() => setCycle(cycle === 'annual' ? 'monthly' : 'annual')}
            >
              <span className={`cycle-knob${cycle === 'annual' ? ' cycle-knob-on' : ''}`}></span>
            </button>
            <span
              className={`cycle-label${cycle === 'annual' ? ' cycle-label-active' : ''}`}
              onClick={() => setCycle('annual')}
            >Annuel</span>
            <span className="cycle-badge">−30% · plusieurs mois offerts</span>
          </div>
        </div>

        <div className="plans">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id]
            const isCurrent = loggedIn && id === currentPlan
            const isPopular = plan.popular
            const classes = ['plan']
            if (isPopular && !isCurrent) classes.push('plan-hot')
            if (isCurrent) classes.push('plan-current')
            let ctaClass = 'cta '
            if (isCurrent) ctaClass += 'cta-current'
            else if (isPopular) ctaClass += 'cta-filled'
            else ctaClass += 'cta-outline'
            return (
              <div key={id} className={classes.join(' ')}>
                {isPopular && !isCurrent && <div className="plan-pop">✦ Plus populaire</div>}
                {isCurrent && <div className="plan-current-tag">● Actuel</div>}
                <div className="plan-tier">
                  {plan.label}
                  {plan.monthlyPrice > 0 && cycle === 'annual' && (
                    <span className="plan-save">−{plan.annualSavingPct}%</span>
                  )}
                </div>
                <div className="plan-tagline">{plan.tagline}</div>
                <div className="plan-price">
                  {plan.monthlyPrice === 0
                    ? plan.price
                    : cycle === 'annual'
                      ? formatEUR(plan.annualMonthlyPrice)
                      : plan.price}
                </div>
                <div className="plan-mo">{plan.priceNumber === 0 ? '/mois · à vie' : '/mois'}</div>
                <div className="plan-billed">
                  {plan.monthlyPrice === 0
                    ? <>Sans CB · gratuit à vie</>
                    : cycle === 'annual'
                      ? <>Facturé annuellement (<strong>{formatEUR(plan.annualYearlyPrice)} / an</strong>) — économisez {plan.annualSavingPct}%</>
                      : <>Facturé mensuellement · sans engagement</>}
                </div>
                <div className="plan-credits">{plan.creditsPerMonth} crédits inclus chaque mois</div>
                <ul className="feats">
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <button
                  className={ctaClass}
                  disabled={isCurrent || busyPlan === id || loggedIn === null}
                  onClick={() => handleChoose(id)}
                >
                  {busyPlan === id ? 'Redirection…' : ctaLabel(id)}
                </button>
              </div>
            )
          })}
        </div>

        <p className="legend">
          ✦ <strong>Génération à la carte</strong> : <strong>2 crédits par document</strong> sélectionné (fiches : facture, devis, relance, remerciement, nouveauté, forfait). Coche autant de documents que tu veux, ne paie que ce que tu génères.<br />
          ✦ <strong>Mails brandés</strong> (remerciement, marketing) — <strong>2 crédits</strong>, réservés aux plans payants (Solo et plus). Envoi via Gmail en un clic.<br />
          ✦ <strong>Régénération</strong> d'un document existant : <strong>2 crédits</strong>, à partir du plan Solo.<br />
          ✦ <strong>Analyse de marque</strong> : 1ère analyse <strong>offerte à vie</strong> à l'inscription, puis <strong>5 crédits</strong> (Starter), <strong>3 crédits</strong> (Solo), <strong>2 crédits</strong> (Studio), <strong>incluse</strong> (Agency).<br />
          {loggedIn === false && '✦ Inscription gratuite, sans carte bancaire pour commencer.'}
          {loggedIn === true && '✦ Le paiement Stripe sera disponible prochainement.'}
        </p>
      </div>

      <footer className="footer">© 2025 BrandSheet · CGU · Mentions légales · Contact</footer>
    </>
  )
}
