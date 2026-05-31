import React from 'react'

export const metadata = {
  title: 'CGU — BrandSheet',
  description: 'Conditions Générales d\'Utilisation de BrandSheet',
}

export default function CGUPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Cormorant Garamond',serif;background:var(--bg-deep);color:var(--text-strong);}
        .nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid var(--border-1);}
        .logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .nav-link{color:var(--text-muted);font-size:15px;font-style:italic;text-decoration:none;}
        .nav-link:hover{color:var(--text-strong);}
        .cgu-wrap{max-width:860px;margin:0 auto;padding:60px 32px 100px;}
        .cgu-eyebrow{font-size:13px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#4F8EF7;margin-bottom:14px;font-style:italic;text-align:center;}
        .cgu-h1{font-family:'Playfair Display',serif;font-size:44px;font-weight:700;line-height:1.1;text-align:center;margin-bottom:8px;}
        .cgu-h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .cgu-sub{text-align:center;color:var(--text-muted);font-style:italic;margin-bottom:48px;font-size:15px;}
        .cgu-highlight{background:var(--bg-elev);border:1px solid var(--decor-subtle);border-left:3px solid #4F8EF7;border-radius:12px;padding:24px 28px;margin:32px 0 44px;font-size:17px;line-height:1.7;color:var(--text-mid);font-style:italic;}
        .cgu-h2{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-top:36px;margin-bottom:12px;color:var(--text-strong);}
        .cgu-p{font-size:16px;line-height:1.75;color:var(--text-mid);margin-bottom:14px;}
        .cgu-p strong{color:var(--text-strong);font-weight:600;}
        .cgu-ul{margin:8px 0 18px 24px;color:var(--text-mid);font-size:16px;line-height:1.75;}
        .cgu-ul li{margin-bottom:6px;}
        .cgu-foot{margin-top:60px;padding-top:24px;border-top:1px solid var(--border-1);font-size:13px;color:var(--text-faint);font-style:italic;text-align:center;}
        @media (max-width:768px){.cgu-wrap{padding:40px 20px 80px;} .cgu-h1{font-size:32px;} .nav{padding:16px 20px;}}
      `}</style>

      <nav className="nav">
        <a href="/" className="logo">BrandSheet</a>
        <a href="/" className="nav-link">← Retour</a>
      </nav>

      <div className="cgu-wrap">
        <div className="cgu-eyebrow">Légal</div>
        <h1 className="cgu-h1">Conditions Générales <em>d&apos;Utilisation</em></h1>
        <p className="cgu-sub">Dernière mise à jour : 31 mai 2026</p>

        <div className="cgu-highlight">
          L&apos;outil BrandSheet accède exclusivement à des informations publiques et librement accessibles sur le web (logos, couleurs, polices). L&apos;utilisateur est seul responsable de l&apos;usage qu&apos;il fait des documents générés et s&apos;engage à respecter le droit des marques de ses prospects.
        </div>

        <h2 className="cgu-h2">1. Objet du service</h2>
        <p className="cgu-p">
          BrandSheet est un outil SaaS d&apos;aide à la production de documents commerciaux (factures, devis, relances, fiches, mails) personnalisés à partir de l&apos;identité visuelle publique d&apos;un site web tiers fourni par l&apos;utilisateur.
        </p>

        <h2 className="cgu-h2">2. Nature des données extraites</h2>
        <p className="cgu-p">
          Le service analyse uniquement des éléments <strong>publics et librement accessibles</strong> sur le site web indiqué par l&apos;utilisateur : couleurs dominantes, typographies, logo, ton éditorial, coordonnées affichées publiquement. Aucun contenu protégé par authentification, aucune donnée personnelle au sens du RGPD au-delà de ce qui est volontairement publié par le site analysé, ni aucun contenu protégé par mesure technique n&apos;est extrait.
        </p>

        <h2 className="cgu-h2">3. Responsabilité de l&apos;utilisateur</h2>
        <p className="cgu-p">
          En lançant une analyse, l&apos;utilisateur <strong>déclare expressément disposer de l&apos;autorisation</strong> nécessaire pour extraire et réutiliser les éléments visuels du site indiqué dans le cadre de sa relation commerciale avec le titulaire de la marque (par exemple : prestataire mandaté, freelance en mission, agence partenaire).
        </p>
        <p className="cgu-p">
          L&apos;utilisateur s&apos;engage à :
        </p>
        <ul className="cgu-ul">
          <li>respecter le <strong>droit des marques</strong> de ses prospects et clients ;</li>
          <li>ne pas usurper une identité ni induire en erreur un destinataire sur l&apos;origine d&apos;un document ;</li>
          <li>n&apos;utiliser les documents générés que dans un cadre licite et professionnel ;</li>
          <li>indemniser BrandSheet en cas de réclamation d&apos;un tiers liée à un usage non autorisé.</li>
        </ul>

        <h2 className="cgu-h2">4. Limitation de responsabilité</h2>
        <p className="cgu-p">
          BrandSheet fournit un outil neutre de traitement d&apos;informations publiques. Elle ne peut être tenue responsable de l&apos;usage que l&apos;utilisateur fait des documents générés, ni d&apos;un litige éventuel avec un tiers titulaire de droits sur les éléments visuels analysés.
        </p>

        <h2 className="cgu-h2">5. Crédits et facturation</h2>
        <p className="cgu-p">
          Chaque analyse ou génération de document consomme un certain nombre de crédits, indiqué dans l&apos;interface avant chaque opération. Les crédits inutilisés ne sont pas remboursables. Les conditions d&apos;abonnement sont précisées sur la page Tarifs.
        </p>

        <h2 className="cgu-h2">6. Données personnelles</h2>
        <p className="cgu-p">
          Les données de compte (email, identifiants OAuth) sont traitées conformément au RGPD. L&apos;utilisateur dispose d&apos;un droit d&apos;accès, de rectification et de suppression à tout moment en nous contactant.
        </p>

        <h2 className="cgu-h2">7. Acceptation</h2>
        <p className="cgu-p">
          L&apos;utilisation du service implique l&apos;acceptation pleine et entière des présentes CGU. La case de consentement affichée avant chaque analyse vaut <strong>déclaration sur l&apos;honneur</strong> d&apos;autorisation d&apos;extraire les éléments visuels du site indiqué.
        </p>

        <div className="cgu-foot">
          © 2026 BrandSheet — Pour toute question : <a href="mailto:maelbfreelance@gmail.com" style={{color:'var(--link-soft)'}}>contact</a>
        </div>
      </div>
    </>
  )
}
