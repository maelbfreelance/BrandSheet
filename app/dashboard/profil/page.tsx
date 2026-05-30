'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  full_name?: string
  company_name?: string
  siret?: string
  address?: string
  postal_code?: string
  city?: string
  country?: string
  email_pro?: string
  phone?: string
  logo_url?: string
}

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile>({ country: 'France' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login'
        return
      }
      setUser(data.user)
      // On ne lit que les colonnes éditables : plan/free_scrape_used/etc.
      // sont gérées côté serveur, on ne les expose pas dans l'état du form
      // (sinon le upsert essaierait de les renvoyer et serait rejeté par
      // les column-grants RLS).
      supabase
        .from('profiles')
        .select('full_name, company_name, siret, address, postal_code, city, country, email_pro, phone, logo_url')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: p }) => {
          if (p) setProfile(p as Profile)
        })
    })
  }, [])

  const handleChange = (k: keyof Profile, v: string) => {
    setProfile({ ...profile, [k]: v })
    setSaved(false)
  }

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/logo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setProfile((p) => ({ ...p, logo_url: data.publicUrl }))
    }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').upsert(
      { user_id: user.id, ...profile, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2400)
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
        .body{max-width:720px;margin:0 auto;padding:60px 24px;}
        .h1{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;margin-bottom:6px;}
        .h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .sub{color:#4A6280;font-style:italic;margin-bottom:32px;}
        .card{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:28px;margin-bottom:20px;}
        .card-h{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;margin-bottom:18px;}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
        .row.full{grid-template-columns:1fr;}
        .field label{display:block;font-size:13px;color:#6B84AA;font-style:italic;margin-bottom:6px;}
        .field input{width:100%;background:#050B18;border:1px solid #0F2040;border-radius:10px;padding:12px 14px;font-size:15px;font-family:'Cormorant Garamond',serif;color:#F0F4FF;outline:none;}
        .field input:focus{border-color:#4F8EF7;}
        .field input::placeholder{color:#1E3050;font-style:italic;}
        .logo-row{display:flex;align-items:center;gap:20px;}
        .logo-preview{width:80px;height:80px;border-radius:14px;border:1px solid #0F2040;background:#050B18;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#1E3050;font-size:11px;font-style:italic;text-align:center;}
        .logo-preview img{max-width:100%;max-height:100%;object-fit:contain;}
        .logo-btn{background:#0D1B35;border:1px solid #0F2040;color:#F0F4FF;padding:10px 18px;border-radius:10px;font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;cursor:pointer;}
        .logo-btn:hover{border-color:#4F8EF7;}
        .actions{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:8px;}
        .saved{color:#4F8EF7;font-style:italic;font-size:14px;}
        .save-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:13px 28px;border-radius:10px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;border:none;cursor:pointer;}
        .save-btn:disabled{opacity:.6;cursor:not-allowed;}
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => (window.location.href = '/dashboard')}>← Mes contacts</button>
      </nav>

      <div className="body">
        <h1 className="h1">Mon <em>profil</em></h1>
        <p className="sub">Ces informations seront utilisées dans les factures, devis et CGV générés.</p>

        <div className="card">
          <div className="card-h">Identité</div>
          <div className="row">
            <div className="field">
              <label>Nom complet</label>
              <input value={profile.full_name || ''} onChange={(e) => handleChange('full_name', e.target.value)} placeholder="Jeanne Dupont" />
            </div>
            <div className="field">
              <label>Raison sociale</label>
              <input value={profile.company_name || ''} onChange={(e) => handleChange('company_name', e.target.value)} placeholder="Studio Dupont" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>SIRET / SIREN</label>
              <input value={profile.siret || ''} onChange={(e) => handleChange('siret', e.target.value)} placeholder="123 456 789 00012" />
            </div>
            <div className="field">
              <label>Email professionnel</label>
              <input value={profile.email_pro || ''} onChange={(e) => handleChange('email_pro', e.target.value)} placeholder="contact@studio.fr" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Téléphone</label>
              <input value={profile.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+33 6 12 34 56 78" />
            </div>
            <div className="field">
              <label>Pays</label>
              <input value={profile.country || ''} onChange={(e) => handleChange('country', e.target.value)} placeholder="France" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">Adresse de facturation</div>
          <div className="row full">
            <div className="field">
              <label>Adresse</label>
              <input value={profile.address || ''} onChange={(e) => handleChange('address', e.target.value)} placeholder="12 rue des Lilas" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Code postal</label>
              <input value={profile.postal_code || ''} onChange={(e) => handleChange('postal_code', e.target.value)} placeholder="75011" />
            </div>
            <div className="field">
              <label>Ville</label>
              <input value={profile.city || ''} onChange={(e) => handleChange('city', e.target.value)} placeholder="Paris" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">Logo</div>
          <div className="logo-row">
            <div className="logo-preview">
              {profile.logo_url ? <img src={profile.logo_url} alt="logo" /> : 'Aucun logo'}
            </div>
            <label className="logo-btn">
              {uploading ? 'Upload…' : profile.logo_url ? 'Remplacer le logo' : 'Téléverser un logo'}
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div className="actions">
          {saved && <span className="saved">✦ Enregistré</span>}
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer →'}
          </button>
        </div>
      </div>
    </>
  )
}
