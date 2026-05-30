'use client'
import React from 'react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Cormorant Garamond',serif;background:var(--bg-deep);color:var(--text-strong);min-height:100vh;display:flex;align-items:center;justify-content:center;}
        .login-wrap{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:20px;padding:48px 40px;max-width:400px;width:100%;text-align:center;}
        .login-logo{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:32px;}
        .login-h{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;margin-bottom:10px;}
        .login-sub{color:var(--text-muted);font-size:16px;font-style:italic;font-weight:300;margin-bottom:36px;line-height:1.7;}
        .login-btn{width:100%;padding:16px;border-radius:12px;border:1px solid var(--border-2);background:var(--line);color:var(--text-strong);font-family:'Cormorant Garamond',serif;font-size:17px;font-style:italic;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;transition:border-color .2s;}
        .login-btn:hover{border-color:#4F8EF7;}
        .login-hint{font-size:13px;color:var(--text-faint);margin-top:20px;font-style:italic;}
      `}</style>
      <div className="login-wrap">
        <div className="login-logo">BrandSheet</div>
        <h1 className="login-h">Connexion</h1>
        <p className="login-sub">Accédez à votre espace<br />et gérez vos contacts brandés.</p>
        <button className="login-btn" onClick={handleGoogle}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuer avec Google
        </button>
        <p className="login-hint">Gratuit · 2 contacts à vie sans CB</p>
      </div>
    </>
  )
}