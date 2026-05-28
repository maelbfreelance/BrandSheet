'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', url: '' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else {
        setUser(data.user)
        loadContacts(data.user.id)
      }
    })
  }, [])

  const loadContacts = async (userId: string) => {
    const { data } = await supabase.from('contacts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setContacts(data)
  }

  const handleAdd = async () => {
    if (!form.name || !form.url) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('contacts').insert([{ name: form.name, url: form.url, user_id: user!.id }])
    setForm({ name: '', url: '' })
    setShowForm(false)
    loadContacts(user!.id)
    setLoading(false)
  }

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
        .dash-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;}
        .dash-welcome{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;}
        .dash-welcome em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .dash-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:12px 24px;border-radius:10px;font-size:16px;font-family:'Cormorant Garamond',serif;font-style:italic;border:none;cursor:pointer;}
        .dash-empty{background:#070F22;border:1px dashed #0F2040;border-radius:16px;padding:60px;text-align:center;}
        .dash-empty-icon{font-size:40px;margin-bottom:16px;}
        .dash-empty-h{font-family:'Playfair Display',serif;font-size:22px;margin-bottom:10px;}
        .dash-empty-p{color:#4A6280;font-size:16px;font-style:italic;}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;}
        .modal{background:#070F22;border:1px solid #0F2040;border-radius:20px;padding:40px;max-width:480px;width:90%;}
        .modal-h{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;margin-bottom:8px;}
        .modal-sub{color:#4A6280;font-size:15px;font-style:italic;margin-bottom:28px;}
        .modal-label{font-size:14px;color:#6B84AA;font-style:italic;margin-bottom:8px;display:block;}
        .modal-input{width:100%;background:#050B18;border:1px solid #0F2040;border-radius:10px;padding:14px 16px;font-size:15px;font-family:'Cormorant Garamond',serif;color:#F0F4FF;outline:none;margin-bottom:20px;}
        .modal-input::placeholder{color:#1E3050;font-style:italic;}
        .modal-actions{display:flex;gap:12px;justify-content:flex-end;}
        .modal-cancel{background:transparent;border:1px solid #0F2040;color:#4A6280;padding:12px 20px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;cursor:pointer;}
        .modal-submit{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:12px 24px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;border:none;cursor:pointer;}
        .contact-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;}
        .contact-card{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:24px;cursor:pointer;transition:border-color .2s;}
        .contact-card:hover{border-color:#4F8EF7;}
        .contact-name{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;margin-bottom:6px;}
        .contact-url{font-size:13px;color:#4A6280;font-style:italic;margin-bottom:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .contact-status{font-size:12px;color:#4F8EF7;font-style:italic;}
      `}</style>

      <nav className="dash-nav">
        <div className="dash-logo">BrandSheet</div>
        <div className="dash-user">
          <span className="dash-email">{user.email}</span>
          <button className="dash-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </nav>

      <div className="dash-body">
        <div className="dash-top">
          <h1 className="dash-welcome">Mes <em>contacts</em></h1>
          <button className="dash-btn" onClick={() => setShowForm(true)}>+ Ajouter un contact</button>
        </div>

        {contacts.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">✦</div>
            <h2 className="dash-empty-h">Aucun contact pour l'instant</h2>
            <p className="dash-empty-p">Ajoutez votre premier client pour générer vos documents brandés.</p>
          </div>
        ) : (
          <div className="contact-grid">
            {contacts.map((c) => (
              <div key={c.id} className="contact-card" onClick={() => window.location.href=`/dashboard/contact/${c.id}`}>
                <div className="contact-name">{c.name}</div>
                <div className="contact-url">{c.url}</div>
                <div className="contact-status">✦ Documents à générer</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-h">Nouveau contact</h2>
            <p className="modal-sub">Entrez les infos de votre client pour analyser son branding.</p>
            <label className="modal-label">Nom du client</label>
            <input className="modal-input" placeholder="Acme Studio" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            <label className="modal-label">URL du site client</label>
            <input className="modal-input" placeholder="https://acme-studio.com" value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="modal-submit" onClick={handleAdd} disabled={loading}>
                {loading ? 'Ajout...' : 'Ajouter →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}