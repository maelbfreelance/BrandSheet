'use client'
import React from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [email, setEmail] = React.useState('')
  const [status, setStatus] = React.useState('')

  // Si un utilisateur déjà connecté arrive sur la LP (notamment juste après
  // un OAuth Google où Supabase a redirigé sur Site URL = '/' au lieu de
  // /dashboard), on le bascule directement sur son dashboard. On écoute aussi
  // onAuthStateChange car le code OAuth peut être présent dans l'URL et
  // l'exchange de session se fait après le 1er render.
  React.useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) window.location.replace('/dashboard')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        window.location.replace('/dashboard')
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  const handleSubmit = async () => {
    if (!email) return
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    if (res.ok) {
      setStatus('success')
      setEmail('')
    } else {
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      setStatus(data.error || 'error')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Cormorant Garamond',serif;background:var(--bg-deep);color:var(--text-strong);}
        .bs-nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid var(--border-1);}
        .bs-logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .bs-nav-desktop{display:flex;gap:32px;align-items:center;}
        .bs-nav-desktop a{color:var(--text-muted);font-size:15px;text-decoration:none;font-style:italic;transition:color .2s;}
        .bs-nav-desktop a:hover{color:var(--text-strong);}
        .bs-btn-nav{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff!important;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:500;font-style:normal;white-space:nowrap;text-decoration:none;}
        .bs-nav-mobile{display:none;align-items:center;gap:14px;}
        .bs-nav-mobile a.bs-mobile-link{color:var(--link-soft);font-size:14px;font-style:italic;text-decoration:none;}
        .bs-btn-nav-mobile{display:none;}
        .bs-hero{text-align:center;padding:90px 24px 60px;max-width:820px;margin:0 auto;}
        .bs-badge{display:inline-flex;align-items:center;gap:9px;background:var(--bg-elev);border:1px solid var(--border-2);border-radius:30px;padding:8px 18px;font-size:13px;color:var(--text-muted);margin-bottom:36px;font-style:italic;}
        .bs-dot{width:6px;height:6px;border-radius:50%;background:#4F8EF7;display:inline-block;flex-shrink:0;}
        .bs-h1{font-family:'Playfair Display',serif;font-size:62px;font-weight:700;line-height:1.08;margin-bottom:10px;letter-spacing:-1.5px;}
        .bs-h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7 30%,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .bs-h1-ghost{font-family:'Playfair Display',serif;font-size:62px;font-style:italic;font-weight:400;color:var(--text-ghost);line-height:1.08;margin-bottom:32px;}
        .bs-sub{font-size:20px;color:var(--text-muted);line-height:1.75;max-width:500px;margin:0 auto 44px;font-weight:300;font-style:italic;}
        .bs-sub strong{font-style:normal;font-weight:500;color:var(--text-mid);}
        .bs-cta-row{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;}
        .bs-input{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:10px;padding:15px 20px;font-size:15px;font-family:'Cormorant Garamond',serif;color:var(--text-strong);width:260px;outline:none;}
        .bs-input::placeholder{color:var(--text-faint);font-style:italic;}
        .bs-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:15px 28px;border-radius:10px;font-size:16px;font-weight:500;font-family:'Cormorant Garamond',serif;border:none;cursor:pointer;}
        .bs-link-pricing{display:inline-block;margin-top:18px;color:var(--link-soft);font-size:15px;font-style:italic;text-decoration:none;border-bottom:1px solid var(--decor-subtle);padding-bottom:2px;}
        .bs-link-pricing:hover{color:var(--text-strong);border-bottom-color:#4F8EF7;}
        .bs-hint{font-size:14px;color:var(--text-faint);margin-top:14px;font-style:italic;}
        .bs-success{font-size:15px;color:#4F8EF7;margin-top:14px;font-style:italic;}
        .bs-mockup-wrap{max-width:680px;margin:60px auto 0;padding:0 24px;}
        .bs-mockup{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:18px;padding:22px;}
        .bs-mock-bar{display:flex;gap:7px;margin-bottom:18px;}
        .bs-mock-dot{width:10px;height:10px;border-radius:50%;}
        .bs-url-bar{background:var(--bg-deep);border:1px solid var(--border-1);border-radius:6px;padding:7px 14px;font-size:13px;color:var(--text-faint);margin-bottom:18px;font-style:italic;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
        .bs-doc-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
        .bs-doc{background:var(--bg-deep);border:1px solid var(--border-1);border-radius:10px;padding:14px;}
        .bs-doc-accent{height:5px;border-radius:3px;margin-bottom:12px;}
        .bs-doc-tag{font-size:11px;font-style:italic;margin-bottom:10px;}
        .bs-line{height:4px;background:var(--line);border-radius:2px;margin-bottom:7px;}
        .bs-line-s{width:55%;height:4px;background:var(--line);border-radius:2px;margin-bottom:7px;}
        .bs-line-m{width:75%;height:4px;background:var(--line);border-radius:2px;margin-bottom:7px;}
        .bs-sep{height:1px;background:var(--border-soft);max-width:1000px;margin:0 auto;}
        .bs-how{padding:80px 44px;max-width:1000px;margin:0 auto;}
        .bs-eyebrow{font-size:13px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#4F8EF7;margin-bottom:16px;font-style:italic;}
        .bs-section-h{font-family:'Playfair Display',serif;font-size:40px;font-weight:700;line-height:1.15;margin-bottom:14px;}
        .bs-section-h em{font-style:italic;color:var(--decor-subtle);}
        .bs-section-p{color:var(--text-muted);font-size:18px;line-height:1.8;max-width:440px;font-weight:300;font-style:italic;}
        .bs-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:50px;}
        .bs-step{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:16px;padding:28px 24px;}
        .bs-step-n{font-family:'Playfair Display',serif;font-size:48px;font-weight:700;font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:18px;line-height:1;}
        .bs-step-h{font-family:'Playfair Display',serif;font-size:19px;font-weight:700;margin-bottom:10px;}
        .bs-step-p{color:var(--text-muted);font-size:16px;line-height:1.8;font-weight:300;font-style:italic;}
        .bs-pricing{padding:80px 44px;max-width:1000px;margin:0 auto;text-align:center;}
        .bs-plans{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:50px;text-align:left;}
        .bs-plan{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:16px;padding:28px 22px;position:relative;}
        .bs-plan-hot{border:1.5px solid #4F8EF7;}
        .bs-plan-pop{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4F8EF7,#7C3AED);font-size:11px;font-style:italic;font-family:'Cormorant Garamond',serif;color:#fff;padding:5px 16px;border-radius:20px;white-space:nowrap;}
        .bs-plan-tier{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:12px;}
        .bs-plan-price{font-family:'Playfair Display',serif;font-size:38px;font-weight:700;line-height:1;margin-bottom:4px;}
        .bs-plan-mo{font-size:15px;color:var(--text-muted);font-style:italic;}
        .bs-plan-contacts{font-size:15px;font-style:italic;color:#4F8EF7;margin:14px 0;padding:12px 0;border-top:1px solid var(--border-1);border-bottom:1px solid var(--border-1);}
        .bs-feats{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:24px;padding:0;}
        .bs-feats li{font-size:15px;color:var(--text-muted);display:flex;gap:8px;align-items:flex-start;font-style:italic;}
        .bs-plan-cta{width:100%;padding:13px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:500;font-style:italic;cursor:pointer;border:none;}
        .bs-cta-outline{background:transparent;border:1px solid var(--border-2);color:var(--text-strong);}
        .bs-cta-filled{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;}
        .bs-final{background:var(--bg-elev);border-top:1px solid var(--border-1);padding:80px 44px;text-align:center;}
        .bs-final-h{font-family:'Playfair Display',serif;font-size:44px;font-weight:700;line-height:1.15;margin-bottom:16px;}
        .bs-final-h em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .bs-final-p{color:var(--text-muted);font-size:19px;margin-bottom:36px;font-style:italic;font-weight:300;}
        .bs-footer{padding:28px 44px;border-top:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}
        .bs-footer-copy{font-size:14px;color:var(--text-faint);font-style:italic;}
        @media (max-width:768px){
          .bs-nav{padding:16px 20px;}
          .bs-nav-desktop{display:none;}
          .bs-nav-mobile{display:flex;}
          .bs-btn-nav-mobile{display:block;background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none;white-space:nowrap;}
          .bs-hero{padding:60px 20px 40px;}
          .bs-badge{font-size:11px;padding:6px 14px;}
          .bs-h1{font-size:36px;letter-spacing:-0.5px;}
          .bs-h1-ghost{font-size:36px;margin-bottom:20px;}
          .bs-sub{font-size:17px;margin-bottom:32px;}
          .bs-cta-row{flex-direction:column;align-items:stretch;}
          .bs-input{width:100%;}
          .bs-btn{width:100%;text-align:center;}
          .bs-mockup-wrap{padding:0 20px;margin-top:40px;}
          .bs-doc-row{grid-template-columns:1fr;}
          .bs-doc:nth-child(2),.bs-doc:nth-child(3){display:none;}
          .bs-how{padding:60px 20px;}
          .bs-section-h{font-size:30px;}
          .bs-steps{grid-template-columns:1fr;gap:14px;margin-top:32px;}
          .bs-step{padding:22px 20px;}
          .bs-pricing{padding:60px 20px;}
          .bs-plans{grid-template-columns:1fr;gap:20px;}
          .bs-final{padding:60px 20px;}
          .bs-final-h{font-size:30px;}
          .bs-final-p{font-size:17px;}
          .bs-footer{flex-direction:column;text-align:center;padding:24px 20px;}
        }
        @media (max-width:1024px) and (min-width:769px){
          .bs-nav{padding:20px 24px;}
          .bs-h1{font-size:48px;}
          .bs-h1-ghost{font-size:48px;}
          .bs-steps{grid-template-columns:1fr;}
          .bs-plans{grid-template-columns:repeat(2,1fr);}
          .bs-how{padding:80px 24px;}
          .bs-pricing{padding:80px 24px;}
        }
      `}</style>

      <nav className="bs-nav">
        <div className="bs-logo">BrandSheet</div>
        <div className="bs-nav-desktop">
          <a href="#how">Fonctionnement</a>
          <a href="/pricing">Tarifs</a>
          <a href="/blog">Blog</a>
          <a href="/login" className="bs-btn-nav">Démarrer gratuitement</a>
        </div>
        <div className="bs-nav-mobile">
          <a href="/pricing" className="bs-mobile-link">Tarifs</a>
          <a href="/login" className="bs-btn-nav-mobile">Commencer →</a>
        </div>
      </nav>

      <div className="bs-hero">
        <div className="bs-badge"><span className="bs-dot"></span>Bêta ouverte · 2 contacts gratuits à vie</div>
        <h1 className="bs-h1">Vos documents,<br /><em>à leur image.</em></h1>
        <div className="bs-h1-ghost">Instantanément.</div>
        <p className="bs-sub">Votre client voit <strong>sa propre identité</strong> sur votre facture.<br />Il se souvient de vous. C&apos;est ça, la différence.</p>
        <div className="bs-cta-row">
          <input
            className="bs-input"
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button className="bs-btn" onClick={handleSubmit}>
            {status === 'success' ? '✅ Inscrit !' : 'Commencer gratuitement →'}
          </button>
        </div>
        {status === 'success' && <p className="bs-success">Bienvenue ! On vous contacte très vite 🎉</p>}
        {status === 'Email déjà inscrit' && <p className="bs-success" style={{color:'#F7954F'}}>Cet email est déjà inscrit !</p>}
        <p className="bs-hint">Aucune carte bancaire · Gratuit pour toujours sur 2 contacts</p>
        <a href="/pricing" className="bs-link-pricing">Voir tous les tarifs →</a>
      </div>

      <div className="bs-mockup-wrap">
        <div className="bs-mockup">
          <div className="bs-mock-bar">
            <div className="bs-mock-dot" style={{background:'#FF5F57'}}></div>
            <div className="bs-mock-dot" style={{background:'#FFBD2E'}}></div>
            <div className="bs-mock-dot" style={{background:'#28C840'}}></div>
          </div>
          <div className="bs-url-bar">🔗 brandsheet.fr/analyse → acme-studio.com</div>
          <div className="bs-doc-row">
            <div className="bs-doc">
              <div className="bs-doc-accent" style={{background:'linear-gradient(90deg,#4F8EF7,#7C3AED)'}}></div>
              <div className="bs-doc-tag" style={{color:'#4F8EF7'}}>Facture</div>
              <div className="bs-line"></div><div className="bs-line-m"></div><div className="bs-line-s"></div><div className="bs-line"></div>
            </div>
            <div className="bs-doc">
              <div className="bs-doc-accent" style={{background:'linear-gradient(90deg,#7C3AED,#C084FC)'}}></div>
              <div className="bs-doc-tag" style={{color:'#A855F7'}}>Relance</div>
              <div className="bs-line-m"></div><div className="bs-line"></div><div className="bs-line-s"></div><div className="bs-line-m"></div>
            </div>
            <div className="bs-doc">
              <div className="bs-doc-accent" style={{background:'linear-gradient(90deg,#06B6D4,#4F8EF7)'}}></div>
              <div className="bs-doc-tag" style={{color:'#06B6D4'}}>CGV</div>
              <div className="bs-line-s"></div><div className="bs-line"></div><div className="bs-line-m"></div><div className="bs-line"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bs-sep" style={{marginTop:'80px'}}></div>

      <div id="how" className="bs-how">
        <div className="bs-eyebrow">Comment ça marche</div>
        <h2 className="bs-section-h">Trois étapes.<br /><em>Zéro friction.</em></h2>
        <p className="bs-section-p">Pas de formation, pas de configuration. Votre premier document brandé est prêt en moins d&apos;une minute.</p>
        <div className="bs-steps">
          <div className="bs-step">
            <div className="bs-step-n">01</div>
            <div className="bs-step-h">Collez l&apos;URL client</div>
            <p className="bs-step-p">Entrez le site web de votre client. BrandSheet récupère son identité visuelle — couleurs, typographies, ton éditorial.</p>
          </div>
          <div className="bs-step">
            <div className="bs-step-n">02</div>
            <div className="bs-step-h">L&apos;IA analyse tout</div>
            <p className="bs-step-p">Palette, typographie, secteur, ton — tout est détecté et structuré, prêt à être appliqué sur chaque document.</p>
          </div>
          <div className="bs-step">
            <div className="bs-step-n">03</div>
            <div className="bs-step-h">Téléchargez et envoyez</div>
            <p className="bs-step-p">Factures, CGV, relances, remerciements — générés, brandés, prêts à envoyer. En PDF ou par email direct.</p>
          </div>
        </div>
      </div>

      <div className="bs-sep"></div>

      <div className="bs-pricing">
        <div className="bs-eyebrow">Tarifs</div>
        <h2 className="bs-section-h" style={{textAlign:'center'}}>Simple.<br /><em>Transparent.</em></h2>
        <p className="bs-section-p" style={{margin:'0 auto',textAlign:'center'}}>Commencez gratuitement. Évoluez à votre rythme.</p>
        <div className="bs-plans">
          <div className="bs-plan">
            <div className="bs-plan-tier">Starter</div>
            <div className="bs-plan-price">0€</div>
            <div className="bs-plan-mo">/mois · à vie</div>
            <div className="bs-plan-contacts">2 contacts inclus</div>
            <ul className="bs-feats">
              <li>20 crédits offerts, puis 10 / mois</li>
              <li>1 analyse offerte, puis 5 crédits</li>
              <li>Génération HTML brandée</li>
              <li>5 derniers documents conservés</li>
            </ul>
            <button className="bs-plan-cta bs-cta-outline" onClick={() => window.location.href='/pricing'}>Voir le détail</button>
          </div>
          <div className="bs-plan">
            <div className="bs-plan-tier">Solo</div>
            <div className="bs-plan-price">9,99€</div>
            <div className="bs-plan-mo">/mois · ou 6,99€/mois en annuel (−30%)</div>
            <div className="bs-plan-contacts">10 contacts</div>
            <ul className="bs-feats">
              <li>100 crédits / mois (cumul possible)</li>
              <li>Analyse de marque : 3 crédits</li>
              <li>Régénération de documents</li>
              <li>CGV &amp; devis générés</li>
              <li>Conservation 30 jours</li>
            </ul>
            <button className="bs-plan-cta bs-cta-outline" onClick={() => window.location.href='/pricing'}>Choisir Solo</button>
          </div>
          <div className="bs-plan bs-plan-hot">
            <div className="bs-plan-pop">✦ Plus populaire</div>
            <div className="bs-plan-tier">Studio</div>
            <div className="bs-plan-price">19,99€</div>
            <div className="bs-plan-mo">/mois · ou 13,99€/mois en annuel (−30%)</div>
            <div className="bs-plan-contacts">25 contacts</div>
            <ul className="bs-feats">
              <li>300 crédits / mois (cumul possible)</li>
              <li>Analyse de marque : 2 crédits</li>
              <li>Toutes les fonctions Solo</li>
              <li>Conservation 1 an</li>
              <li>Support prioritaire</li>
            </ul>
            <button className="bs-plan-cta bs-cta-filled" onClick={() => window.location.href='/pricing'}>Choisir Studio</button>
          </div>
          <div className="bs-plan">
            <div className="bs-plan-tier">Agency</div>
            <div className="bs-plan-price">59,99€</div>
            <div className="bs-plan-mo">/mois · ou 41,99€/mois en annuel (−30%)</div>
            <div className="bs-plan-contacts">Contacts illimités</div>
            <ul className="bs-feats">
              <li>1 000 crédits / mois (cumul possible)</li>
              <li>Conservation illimitée</li>
              <li>Toutes les fonctions Studio</li>
              <li>Accompagnement dédié</li>
            </ul>
            <button className="bs-plan-cta bs-cta-outline" onClick={() => window.location.href='/pricing'}>Choisir Agency</button>
          </div>
        </div>
      </div>

      <div className="bs-final">
        <h2 className="bs-final-h">Votre prochain client<br />mérite des documents<br /><em>à sa hauteur.</em></h2>
        <p className="bs-final-p">Rejoignez les freelances qui impressionnent leurs clients dès la première facture.</p>
        <div className="bs-cta-row">
          <input
            className="bs-input"
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button className="bs-btn" onClick={handleSubmit}>
            {status === 'success' ? '✅ Inscrit !' : 'Commencer gratuitement →'}
          </button>
        </div>
        {status === 'success' && <p className="bs-success">Bienvenue ! On vous contacte très vite 🎉</p>}
        <p className="bs-hint">Gratuit · Sans CB · 2 contacts à vie</p>
      </div>

      <footer className="bs-footer">
        <div className="bs-logo" style={{fontSize:'16px'}}>BrandSheet</div>
        <div className="bs-footer-copy">© 2025 BrandSheet · CGU · Mentions légales · Contact</div>
      </footer>
    </>
  )
}