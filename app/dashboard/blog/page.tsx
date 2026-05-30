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

export default function BlogAdminPage() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/login'
        return
      }
      setUser(data.session.user)
      supabase.from('profiles').select('is_admin').eq('user_id', data.session.user.id).maybeSingle()
        .then(({ data: p }) => setIsAdmin(!!p?.is_admin))
      loadPosts()
    })
  }, [])

  const loadPosts = async () => {
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, media_url, media_type, created_at')
      .order('created_at', { ascending: false })
    setPosts(data ?? [])
  }

  const handleUpload = async () => {
    if (!user || !file || !title.trim()) return
    setBusy(true)
    setMsg('')
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const isPdf = ext === 'pdf' || file.type === 'application/pdf'
    const mediaType: 'image' | 'pdf' = isPdf ? 'pdf' : 'image'
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('blog').upload(path, file, { upsert: false })
    if (upErr) {
      setMsg(`Erreur upload : ${upErr.message}`)
      setBusy(false)
      return
    }
    const { data: pub } = supabase.storage.from('blog').getPublicUrl(path)
    const { error: insErr } = await supabase.from('blog_posts').insert({
      title: title.trim(),
      media_url: pub.publicUrl,
      media_type: mediaType,
      author_id: user.id,
    })
    if (insErr) {
      setMsg(`Erreur enregistrement : ${insErr.message}`)
      setBusy(false)
      return
    }
    setTitle('')
    setFile(null)
    setMsg('✓ Publié')
    setTimeout(() => setMsg(''), 2500)
    loadPosts()
    setBusy(false)
  }

  const handleDelete = async (p: Post) => {
    if (!confirm(`Supprimer "${p.title}" ?`)) return
    // Extraire le chemin du bucket depuis l'URL publique
    const marker = '/storage/v1/object/public/blog/'
    const idx = p.media_url.indexOf(marker)
    if (idx >= 0) {
      const path = p.media_url.slice(idx + marker.length)
      await supabase.storage.from('blog').remove([path])
    }
    await supabase.from('blog_posts').delete().eq('id', p.id)
    loadPosts()
  }

  if (isAdmin === null) return null

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
        .body{max-width:880px;margin:0 auto;padding:50px 24px;}
        .h1{font-family:'Playfair Display',serif;font-size:34px;font-weight:700;margin-bottom:6px;}
        .h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .sub{color:var(--text-muted);font-style:italic;margin-bottom:32px;}
        .card{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:16px;padding:26px;margin-bottom:24px;}
        .card-h{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;margin-bottom:16px;}
        .field{margin-bottom:14px;}
        .field label{display:block;font-size:13px;color:var(--text-mid);font-style:italic;margin-bottom:6px;}
        .field input[type="text"]{width:100%;background:var(--bg-deep);border:1px solid var(--border-2);border-radius:10px;padding:12px 14px;font-size:15px;font-family:'Cormorant Garamond',serif;color:var(--text-strong);outline:none;}
        .field input[type="text"]:focus{border-color:#4F8EF7;}
        .file-row{display:flex;align-items:center;gap:14px;}
        .file-btn{background:var(--line);border:1px solid var(--border-2);color:var(--text-strong);padding:10px 18px;border-radius:10px;font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;cursor:pointer;}
        .file-name{font-size:14px;color:var(--text-muted);font-style:italic;}
        .actions{display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:8px;}
        .msg{font-style:italic;font-size:14px;color:#4F8EF7;}
        .msg.err{color:#dc2626;}
        .pub-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:12px 26px;border-radius:10px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;border:none;cursor:pointer;}
        .pub-btn:disabled{opacity:.5;cursor:not-allowed;}
        .post-row{display:flex;gap:16px;align-items:center;padding:14px;border:1px solid var(--border-2);border-radius:12px;background:var(--bg-deep);margin-bottom:10px;}
        .post-thumb{width:64px;height:64px;border-radius:8px;overflow:hidden;background:var(--bg-elev);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:14px;color:var(--text-muted);}
        .post-thumb img{width:100%;height:100%;object-fit:cover;}
        .post-info{flex:1;min-width:0;}
        .post-title{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;}
        .post-meta{font-size:13px;color:var(--text-faint);font-style:italic;}
        .del-btn{background:transparent;border:1px solid var(--border-2);color:var(--text-muted);padding:8px 14px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-style:italic;cursor:pointer;}
        .del-btn:hover{color:#dc2626;border-color:#dc2626;}
        .locked{text-align:center;padding:60px 20px;color:var(--text-muted);font-style:italic;font-size:18px;}
        .locked em{font-style:italic;color:var(--text-strong);}
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => (window.location.href = '/dashboard')}>← Dashboard</button>
      </nav>

      <div className="body">
        <h1 className="h1">Blog <em>— admin</em></h1>
        <p className="sub">Espace réservé. Seuls les comptes <em>admin</em> peuvent publier.</p>

        {!isAdmin ? (
          <div className="card">
            <div className="locked">
              Tu n&apos;as pas les droits <em>admin</em> sur cet espace.<br />
              Le blog reste consultable publiquement <a href="/blog" style={{color:'#4F8EF7'}}>ici</a>.
            </div>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="card-h">Nouveau post</div>
              <div className="field">
                <label>Titre</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Le titre du post"
                />
              </div>
              <div className="field">
                <label>Média (PNG, JPG ou PDF)</label>
                <div className="file-row">
                  <label className="file-btn">
                    Choisir un fichier
                    <input
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <span className="file-name">{file ? file.name : 'Aucun fichier sélectionné'}</span>
                </div>
              </div>
              <div className="actions">
                {msg && <span className={`msg ${msg.startsWith('Erreur') ? 'err' : ''}`}>{msg}</span>}
                <button
                  className="pub-btn"
                  onClick={handleUpload}
                  disabled={busy || !title.trim() || !file}
                >
                  {busy ? 'Publication…' : 'Publier'}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-h">Posts existants ({posts.length})</div>
              {posts.length === 0 ? (
                <div style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Aucun post pour le moment.</div>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="post-row">
                    <div className="post-thumb">
                      {p.media_type === 'image' ? <img src={p.media_url} alt="" /> : 'PDF'}
                    </div>
                    <div className="post-info">
                      <div className="post-title">{p.title}</div>
                      <div className="post-meta">{new Date(p.created_at).toLocaleDateString('fr-FR')} · {p.media_type.toUpperCase()}</div>
                    </div>
                    <button className="del-btn" onClick={() => handleDelete(p)}>Supprimer</button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
