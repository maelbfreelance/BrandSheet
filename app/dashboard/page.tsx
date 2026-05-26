'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUser(data.user)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!user) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Cormorant Garamond',serif;background:#050B18;color:#F0F4FF;}
        .dash-nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid #0F1E3A;}
        .dash-logo{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .dash-user{display:flex;align-items:center;gap:16px;}
        .dash-email{font-size:14px;color:#4A6280;font-style:italic;}
        .dash-logout{font-size:14px;color:#1E3050;font-style:italic;cursor:pointer;background:none;border:none;font-family:'Cormorant Garamond',serif;}
        .dash-logout:hover{color:#F0F4FF;}
        .dash-body{max-width:900px;margin:0 auto;padding:60px 24px;}
        .dash-welcome{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;margin-bottom:8px;}
        .dash-welcome em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .dash-sub{color:#4A6280;font-size:17px;font-style:italic;margin-bottom:48px;}
        .dash-empty{background:#070F22;border:1px dashed #0F2040;border-radius:16px;padding:60px;text-align:center;}
        .dash-empty-icon{font-size:40px;margin-bottom:16px;}
        .dash-empty-h{font-family:'Playfair Display',serif;font-size:22px;margin-bottom:10px;}
        .dash-empty-p{color:#4A6280;font-size:16px;font-style:italic;margin-bottom:28px;}
        .dash-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:14px 28px;border-radius:10px;font-size:16px;font-family:'Cormorant Garamond',serif;font-style:italic;border:none;cursor:pointer;}
      `}</style>
      <nav className="dash-nav">
        <div className="dash-logo">BrandSheet</div>
        <div className="dash-user">
          <span className="dash-email">{user.email}</span>
          <button className="dash-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </nav>
      <div className="dash-body">
        <h1 className="dash-welcome">Bonjour, <em>bienvenue.</em></h1>
        <p className="dash-sub">Vos contacts brandés apparaîtront ici.</p>
        <div className="dash-empty">
          <div className="dash-empty-icon">✦</div>
          <h2 className="dash-empty-h">Aucun contact pour l'instant</h2>
          <p className="dash-empty-p">Ajoutez votre premier client pour générer<br />vos documents brandés en 30 secondes.</p>
          <button className="dash-btn">+ Ajouter un contact</button>
        </div>
      </div>
    </>
  )
}