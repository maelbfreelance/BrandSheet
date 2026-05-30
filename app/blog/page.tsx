'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Post = {
  id: string
  title: string
  media_url: string
  media_type: 'image' | 'pdf'
  created_at: string
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [authed, setAuthed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewer, setViewer] = useState<Post | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      if (data.session?.user) {
        supabase.from('profiles').select('is_admin').eq('user_id', data.session.user.id).maybeSingle()
          .then(({ data: p }) => setIsAdmin(!!p?.is_admin))
      }
    })
    supabase
      .from('blog_posts')
      .select('id, title, media_url, media_type, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPosts(data ?? []))
  }, [])

  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewer(null) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [viewer])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Cormorant Garamond',serif;background:var(--bg-deep);color:var(--text-strong);}
        .nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid var(--border-1);}
        .logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;cursor:pointer;}
        .nav-right{display:flex;gap:24px;align-items:center;}
        .nav-link{color:var(--text-muted);font-size:15px;font-style:italic;text-decoration:none;cursor:pointer;}
        .nav-link:hover{color:var(--text-strong);}
        .nav-cta{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff!important;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:500;font-style:normal;text-decoration:none;}
        .blog-wrap{max-width:1180px;margin:0 auto;padding:60px 32px 100px;}
        .blog-head{text-align:center;margin-bottom:48px;}
        .blog-eyebrow{font-size:13px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#4F8EF7;margin-bottom:14px;font-style:italic;}
        .blog-h1{font-family:'Playfair Display',serif;font-size:52px;font-weight:700;letter-spacing:-1px;line-height:1.1;}
        .blog-h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .empty{text-align:center;color:var(--text-faint);font-style:italic;font-size:20px;padding:120px 20px;}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;}
        .card{cursor:pointer;display:flex;flex-direction:column;gap:12px;}
        .thumb{position:relative;width:100%;aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:var(--bg-elev);border:1px solid var(--border-2);transition:transform .25s ease;}
        .card:hover .thumb{transform:scale(1.025);}
        .thumb img{width:100%;height:100%;object-fit:cover;display:block;}
        .pdf-thumb{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text-muted);font-style:italic;}
        .pdf-thumb .pdf-icon{font-family:'Playfair Display',serif;font-size:48px;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .overlay{position:absolute;inset:0;background:rgba(0,0,0,0);display:flex;align-items:center;justify-content:center;transition:background .25s ease;}
        .card:hover .overlay{background:rgba(0,0,0,0.45);}
        .read{font-family:'Playfair Display',serif;font-style:italic;font-size:26px;color:#fff;opacity:0;transform:translateY(6px);transition:opacity .25s ease,transform .25s ease;letter-spacing:1px;}
        .card:hover .read{opacity:1;transform:translateY(0);}
        .title{font-family:'Playfair Display',serif;font-size:19px;font-weight:700;line-height:1.3;color:var(--text-strong);padding:0 4px;}
        .date{font-size:13px;color:var(--text-faint);font-style:italic;padding:0 4px;}
        /* Viewer fullscreen */
        .viewer{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:1000;display:flex;align-items:center;justify-content:center;padding:40px;cursor:zoom-out;}
        .viewer img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;}
        .viewer iframe{width:min(1100px,100%);height:90vh;border:none;border-radius:8px;background:#fff;}
        .viewer-close{position:absolute;top:22px;right:28px;background:none;border:none;color:#fff;font-size:34px;font-family:'Cormorant Garamond',serif;cursor:pointer;line-height:1;}
        .viewer-title{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:#fff;font-family:'Playfair Display',serif;font-style:italic;font-size:18px;text-align:center;max-width:80%;}
        @media (max-width:1024px){
          .grid{grid-template-columns:repeat(2,1fr);gap:22px;}
          .blog-h1{font-size:42px;}
        }
        @media (max-width:640px){
          .nav{padding:16px 20px;}
          .nav-right{gap:14px;}
          .nav-link{font-size:14px;}
          .blog-wrap{padding:40px 20px 80px;}
          .blog-h1{font-size:34px;}
          .grid{grid-template-columns:1fr;gap:20px;}
          .viewer{padding:16px;}
          .viewer iframe{height:80vh;}
          .read{font-size:22px;}
          /* Sur mobile, l'overlay reste visible en permanence pour signaler le tap */
          .overlay{background:rgba(0,0,0,0.18);}
          .read{opacity:1;transform:none;}
        }
      `}</style>

      <nav className="nav">
        <div className="logo" onClick={() => (window.location.href = authed ? '/dashboard' : '/')}>BrandSheet</div>
        <div className="nav-right">
          {authed ? (
            <>
              <a className="nav-link" onClick={() => (window.location.href = '/dashboard')}>Dashboard</a>
              <a className="nav-link" onClick={() => (window.location.href = '/pricing')}>Tarifs</a>
              {isAdmin && <a className="nav-link" onClick={() => (window.location.href = '/dashboard/blog')}>Gérer</a>}
            </>
          ) : (
            <>
              <a className="nav-link" onClick={() => (window.location.href = '/')}>Accueil</a>
              <a className="nav-link" onClick={() => (window.location.href = '/pricing')}>Tarifs</a>
              <a className="nav-cta" onClick={() => (window.location.href = '/login')}>Démarrer →</a>
            </>
          )}
        </div>
      </nav>

      <div className="blog-wrap">
        <div className="blog-head">
          <div className="blog-eyebrow">Journal</div>
          <h1 className="blog-h1">Le <em>blog</em>.</h1>
        </div>

        {posts === null ? (
          <div className="empty">Chargement…</div>
        ) : posts.length === 0 ? (
          <div className="empty">rien pour le moment</div>
        ) : (
          <div className="grid">
            {posts.map((p) => (
              <div key={p.id} className="card" onClick={() => setViewer(p)}>
                <div className="thumb">
                  {p.media_type === 'image' ? (
                    <img src={p.media_url} alt={p.title} loading="lazy" />
                  ) : (
                    <div className="pdf-thumb">
                      <span className="pdf-icon">PDF</span>
                      <span>Document</span>
                    </div>
                  )}
                  <div className="overlay"><span className="read">Lire</span></div>
                </div>
                <div className="title">{p.title}</div>
                <div className="date">{new Date(p.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewer && (
        <div className="viewer" onClick={() => setViewer(null)}>
          <button className="viewer-close" onClick={(e) => { e.stopPropagation(); setViewer(null) }} aria-label="Fermer">×</button>
          {viewer.media_type === 'image' ? (
            <img src={viewer.media_url} alt={viewer.title} onClick={(e) => e.stopPropagation()} />
          ) : (
            <iframe src={viewer.media_url} title={viewer.title} onClick={(e) => e.stopPropagation()} />
          )}
          <div className="viewer-title">{viewer.title}</div>
        </div>
      )}
    </>
  )
}
