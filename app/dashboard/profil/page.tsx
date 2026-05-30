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

type AccountType = 'freelance' | 'brand'

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile>({ country: 'France' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>('freelance')
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/login'
        return
      }
      setUser(data.user)
      // On lit aussi account_type (en lecture seule côté client : son écriture
      // passe par /api/profile/account-type qui utilise supabaseAdmin, car la
      // colonne est exclue des GRANT UPDATE côté client).
      supabase
        .from('profiles')
        .select('full_name, company_name, siret, address, postal_code, city, country, email_pro, phone, logo_url, account_type')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: p }) => {
          if (p) {
            const { account_type, ...editable } = p as Profile & { account_type?: string }
            setProfile(editable as Profile)
            if (account_type === 'brand' || account_type === 'freelance') setAccountType(account_type)
          }
        })
    })
  }, [])

  const handleAccountTypeChange = async (next: AccountType) => {
    if (!user || next === accountType) return
    setSwitching(true)
    const previous = accountType
    setAccountType(next) // optimiste
    try {
      const res = await fetch('/api/profile/account-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, accountType: next }),
      })
      if (!res.ok) setAccountType(previous)
    } catch {
      setAccountType(previous)
    }
    setSwitching(false)
  }

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
        body{font-family:'Cormorant Garamond',serif;background:var(--bg-deep);color:var(--text-strong);}
        .nav{display:flex;justify-content:space-between;align-items:center;padding:20px 44px;border-bottom:1px solid var(--border-1);}
        .logo{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .back{font-size:14px;color:var(--text-muted);font-style:italic;cursor:pointer;background:none;border:none;font-family:'Cormorant Garamond',serif;}
        .back:hover{color:var(--text-strong);}
        .body{max-width:720px;margin:0 auto;padding:60px 24px;}
        .h1{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;margin-bottom:6px;}
        .h1 em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .sub{color:var(--text-muted);font-style:italic;margin-bottom:32px;}
        .card{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:16px;padding:28px;margin-bottom:20px;}
        .card-h{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;margin-bottom:18px;}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
        .row.full{grid-template-columns:1fr;}
        .field label{display:block;font-size:13px;color:var(--text-mid);font-style:italic;margin-bottom:6px;}
        .field input{width:100%;background:var(--bg-deep);border:1px solid var(--border-2);border-radius:10px;padding:12px 14px;font-size:15px;font-family:'Cormorant Garamond',serif;color:var(--text-strong);outline:none;}
        .field input:focus{border-color:#4F8EF7;}
        .field input::placeholder{color:var(--text-faint);font-style:italic;}
        .logo-row{display:flex;align-items:center;gap:20px;}
        .logo-preview{width:80px;height:80px;border-radius:14px;border:1px solid var(--border-2);background:var(--bg-deep);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--text-faint);font-size:11px;font-style:italic;text-align:center;}
        .logo-preview img{max-width:100%;max-height:100%;object-fit:contain;}
        .logo-btn{background:var(--line);border:1px solid var(--border-2);color:var(--text-strong);padding:10px 18px;border-radius:10px;font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;cursor:pointer;}
        .logo-btn:hover{border-color:#4F8EF7;}
        .actions{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:8px;}
        .saved{color:#4F8EF7;font-style:italic;font-size:14px;}
        .save-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:13px 28px;border-radius:10px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;border:none;cursor:pointer;}
        .save-btn:disabled{opacity:.6;cursor:not-allowed;}
        .acct-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .acct-opt{position:relative;background:var(--bg-deep);border:1px solid var(--border-2);border-radius:12px;padding:18px 18px 16px;cursor:pointer;transition:border-color .15s,background .15s;}
        .acct-opt:hover{border-color:var(--text-faint);}
        .acct-opt.active{border-color:#4F8EF7;background:var(--border-soft);}
        .acct-opt .acct-tag{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--text-strong);margin-bottom:4px;}
        .acct-opt .acct-desc{font-size:13px;font-style:italic;color:var(--text-mid);line-height:1.45;}
        .acct-opt .acct-pin{position:absolute;top:14px;right:14px;font-size:14px;color:#4F8EF7;opacity:0;transition:opacity .15s;}
        .acct-opt.active .acct-pin{opacity:1;}
        .acct-note{margin-top:14px;font-size:13px;font-style:italic;color:var(--text-muted);}
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => (window.location.href = '/dashboard')}>← Mes contacts</button>
      </nav>

      <div className="body">
        <h1 className="h1">Mon <em>profil</em></h1>
        <p className="sub">Ces informations seront utilisées dans les factures, devis et CGV générés.</p>

        <div className="card">
          <div className="card-h">Type de compte</div>
          <div className="acct-row">
            <div
              className={`acct-opt ${accountType === 'freelance' ? 'active' : ''}`}
              onClick={() => !switching && handleAccountTypeChange('freelance')}
            >
              <span className="acct-pin">✦</span>
              <div className="acct-tag">Freelance</div>
              <div className="acct-desc">Tu envoies les documents à tes clients. La marque scrapée donne les couleurs ; le contenu parle en TON nom et raconte ta mission.</div>
            </div>
            <div
              className={`acct-opt ${accountType === 'brand' ? 'active' : ''}`}
              onClick={() => !switching && handleAccountTypeChange('brand')}
            >
              <span className="acct-pin">✦</span>
              <div className="acct-tag">Marque</div>
              <div className="acct-desc">Tu envoies les documents à tes propres clients depuis ta marque. Couleurs ET contenu parlent au nom de la marque scrapée.</div>
            </div>
          </div>
          <div className="acct-note">Tu peux basculer à tout moment. Les nouveaux documents reflètent le mode courant ; les anciens restent inchangés.</div>
        </div>

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
