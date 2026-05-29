'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { PLANS, PlanId, applyRetention } from '@/lib/plans'

export default function ContactPage() {
  const { id } = useParams()
  const [contact, setContact] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [brand, setBrand] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false)
  const [showMoreData, setShowMoreData] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [showNoCredits, setShowNoCredits] = useState(false)
  const [operations, setOperations] = useState<any[]>([])
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null)
  const [showOpForm, setShowOpForm] = useState(false)
  const [opForm, setOpForm] = useState<{ name: string; description: string; files: File[] }>({ name: '', description: '', files: [] })
  const [opSaving, setOpSaving] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)
  const [deleteOpModal, setDeleteOpModal] = useState<string | null>(null)
  const [deleteOpConfirmed, setDeleteOpConfirmed] = useState(false)
  const [plan, setPlan] = useState<PlanId>('starter')

  const loadOperations = async () => {
    const { data } = await supabase.from('operations').select('*').eq('contact_id', id).order('created_at', { ascending: false })
    if (data) setOperations(data)
  }

  useEffect(() => {
    supabase.from('contacts').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setContact(data)
        if (data.brand_colors && data.brand_colors.length > 0) setBrand(data)
      }
    })
    supabase.from('documents').select('*').eq('contact_id', id).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setDocs(data)
    })
    loadOperations()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('user_credits').select('credits').eq('user_id', data.user.id).maybeSingle().then(({ data: c }) => {
        setCredits(c?.credits ?? 0)
      })
      supabase.from('profiles').select('plan').eq('user_id', data.user.id).maybeSingle().then(({ data: p }) => {
        if (p?.plan && p.plan in PLANS) setPlan(p.plan as PlanId)
      })
    })
  }, [id])

  const handleDeleteOperation = async () => {
    if (!deleteOpConfirmed || !deleteOpModal) return
    const opId = deleteOpModal
    await supabase.from('operations').delete().eq('id', opId)
    if (selectedOpId === opId) setSelectedOpId(null)
    setDeleteOpModal(null)
    setDeleteOpConfirmed(false)
    await loadOperations()
    const { data: refreshed } = await supabase.from('documents').select('*').eq('contact_id', id).order('created_at', { ascending: false })
    if (refreshed) setDocs(refreshed)
  }

  const docTypeLabels: Record<string, string> = {
    bienvenue: 'Mail bienvenue',
    remerciement: 'Remerciement',
    avis: 'Demande avis',
    facture: 'Facture',
    devis: 'Devis',
    cgv: 'CGV',
  }

  const handleDownloadDoc = (doc: any) => {
    const content = doc.content || ''
    const isHtml = content.trim().startsWith('<')
    const blob = new Blob([content], { type: isHtml ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const opName = operations.find(o => o.id === doc.operation_id)?.name || 'sans-operation'
    const slug = `${opName}-${doc.type}-${new Date(doc.created_at).toISOString().slice(0, 10)}`
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    a.href = url
    a.download = `${slug}.${isHtml ? 'html' : 'txt'}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const [viewerDoc, setViewerDoc] = useState<any>(null)
  const [historyFullscreen, setHistoryFullscreen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingDoc, setIsSavingDoc] = useState(false)
  const [isRegen, setIsRegen] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const viewerIframeRef = React.useRef<HTMLIFrameElement>(null)

  const openViewer = (doc: any) => {
    setDocError(null)
    setIsEditing(false)
    setViewerDoc(doc)
  }
  const closeViewer = () => {
    setViewerDoc(null)
    setIsEditing(false)
    setDocError(null)
  }
  const toggleEdit = () => {
    const w = viewerIframeRef.current?.contentWindow as any
    if (!w?.brandsheetSetEdit) return
    const next = !isEditing
    w.brandsheetSetEdit(next)
    setIsEditing(next)
  }
  const saveDocEdits = async () => {
    if (!viewerDoc) return
    const w = viewerIframeRef.current?.contentWindow as any
    if (!w?.brandsheetGetHTML) return
    setIsSavingDoc(true)
    setDocError(null)
    try {
      const content = w.brandsheetGetHTML()
      const res = await fetch('/api/doc-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: viewerDoc.id, content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`)
      setDocs((prev) => prev.map((d) => (d.id === viewerDoc.id ? { ...d, content } : d)))
      setViewerDoc({ ...viewerDoc, content })
      w.brandsheetSetEdit(false)
      setIsEditing(false)
    } catch (e) {
      setDocError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSavingDoc(false)
    }
  }
  const regenerateDoc = async () => {
    if (!viewerDoc) return
    setIsRegen(true)
    setDocError(null)
    try {
      const res = await fetch('/api/regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: viewerDoc.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.detail || data.error || `HTTP ${res.status}`)
      const updated = { ...viewerDoc, content: data.content }
      setDocs((prev) => prev.map((d) => (d.id === viewerDoc.id ? updated : d)))
      setViewerDoc(updated)
      if (typeof data.credits === 'number') setCredits(data.credits)
    } catch (e) {
      setDocError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsRegen(false)
    }
  }

  const handleCreateOperation = async () => {
    if (!opForm.name.trim()) {
      setOpError('Le nom est requis')
      return
    }
    setOpError(null)
    setOpSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const imageUrls: string[] = []
      for (const file of opForm.files) {
        const ext = file.name.split('.').pop() || 'png'
        const path = `${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('operations').upload(path, file, { upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('operations').getPublicUrl(path)
        imageUrls.push(pub.publicUrl)
      }

      const { error: insErr } = await supabase.from('operations').insert({
        contact_id: id,
        user_id: user.id,
        name: opForm.name.trim(),
        description: opForm.description.trim() || null,
        images: imageUrls,
      })
      if (insErr) throw insErr

      setOpForm({ name: '', description: '', files: [] })
      setShowOpForm(false)
      await loadOperations()
    } catch (e) {
      setOpError(e instanceof Error ? e.message : String(e))
    } finally {
      setOpSaving(false)
    }
  }

  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setShowReanalyzeConfirm(false)
    setAnalyzeError(null)
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: contact.url, contactId: id })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAnalyzeError(data.detail || data.error || `HTTP ${res.status}`)
      } else {
        setBrand(data)
        setContact({ ...contact, ...data })
      }
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAnalyzeClick = () => {
    if (brand) {
      setShowReanalyzeConfirm(true)
    } else {
      handleAnalyze()
    }
  }

  const handleGenerate = async () => {
    if ((credits ?? 0) < 10) {
      setShowNoCredits(true)
      return
    }
    setGenerating(true)
    const res = await fetch('/api/gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: id, operationId: selectedOpId })
    })
    const data = await res.json()
    if (res.status === 402) {
      setCredits(data.credits ?? 0)
      setShowNoCredits(true)
      setGenerating(false)
      return
    }
    if (data.success) {
      setGenerated(true)
      if (typeof data.credits === 'number') setCredits(data.credits)
      const { data: newDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
      if (newDocs) setDocs(newDocs)
    }
    setGenerating(false)
  }

  if (!contact) return null

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
        .contact-header{padding:32px 44px 0;max-width:1200px;margin:0 auto;text-align:center;}
        .contact-title{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;margin-bottom:6px;}
        .contact-url{font-size:15px;color:#4A6280;font-style:italic;}
        .layout{display:grid;grid-template-columns:200px 240px 1fr;gap:20px;padding:24px 44px 44px;max-width:1200px;margin:0 auto;}
        .col{display:flex;flex-direction:column;gap:14px;}
        .panel{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:20px;}
        .panel-h{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;margin-bottom:14px;color:#6B84AA;font-style:italic;}
        .colors{display:flex;flex-wrap:wrap;gap:8px;}
        .color-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;}
        .color-chip{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;transition:transform .15s;}
        .color-chip:hover{transform:scale(1.1);}
        .color-hex{font-size:10px;color:#4A6280;font-family:monospace;}
        .font-item{font-size:13px;color:#6B84AA;font-style:italic;padding:5px 0;border-bottom:1px solid #0F1E3A;}
        .font-item:last-child{border-bottom:none;}
        .tone-badge{display:inline-block;background:#0D1B35;border:1px solid #0F2040;border-radius:20px;padding:5px 12px;font-size:12px;font-style:italic;color:#4F8EF7;margin-top:6px;}
        .action-btn{width:100%;padding:13px;border-radius:12px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;cursor:pointer;border:none;text-align:left;display:flex;align-items:center;gap:10px;transition:all .2s;margin-bottom:10px;}
        .action-btn:last-child{margin-bottom:0;}
        .action-primary{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;}
        .action-secondary{background:#0D1B35;border:1px solid #0F2040;color:#F0F4FF;}
        .action-secondary:hover{border-color:#4F8EF7;}
        .doc-item{background:#050B18;border:1px solid #0F1E3A;border-radius:10px;padding:11px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:border-color .2s;margin-bottom:8px;}
        .doc-item:last-child{margin-bottom:0;}
        .doc-item:hover{border-color:#4F8EF7;}
        .doc-item-selected{background:rgba(79,142,247,0.18);border-color:#7BAAFB;box-shadow:0 0 0 1px #7BAAFB inset;}
        .doc-item-selected .doc-label{color:#A8C8FC;}
        .doc-item-selected .doc-status{color:#7BAAFB;}
        .doc-item-selected .doc-icon{color:#A8C8FC;}
        .doc-item-selected .doc-arrow{color:#7BAAFB;}
        .doc-item-left{display:flex;align-items:center;gap:10px;}
        .doc-icon{font-size:15px;color:#4F8EF7;}
        .doc-label{font-size:13px;font-style:italic;}
        .doc-status{font-size:11px;color:#4A6280;font-style:italic;}
        .doc-arrow{font-size:11px;color:#1E3050;}
        .main-panel{background:#070F22;border:1px solid #0F2040;border-radius:16px;padding:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:420px;text-align:center;}
        .main-panel-h{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;margin-bottom:10px;}
        .main-panel-p{color:#4A6280;font-size:15px;font-style:italic;margin-bottom:28px;max-width:300px;line-height:1.7;}
        .analyze-btn{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:16px 32px;border-radius:12px;font-size:17px;font-family:'Playfair Display',serif;font-style:italic;border:none;cursor:pointer;}
        .analyzing-text{font-family:'Playfair Display',serif;font-size:20px;font-style:italic;color:#4A6280;animation:pulse 2s infinite;}
        .analyzing-sub{font-size:13px;color:#1E3050;margin-top:10px;font-style:italic;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        .brand-result{width:100%;text-align:left;}
        .brand-result-h{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:16px;}
        .brand-result-h em{font-style:italic;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;}
        .info-card{background:#050B18;border-radius:10px;padding:12px;}
        .info-label{font-size:11px;color:#4A6280;font-style:italic;margin-bottom:3px;}
        .info-value{font-size:14px;font-weight:500;}
        .generate-btn{width:100%;padding:15px;border-radius:12px;background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;font-family:'Playfair Display',serif;font-size:16px;font-style:italic;border:none;cursor:pointer;margin-top:20px;}
        .generate-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .cost-hint{margin-top:8px;text-align:center;font-size:12px;color:#4A6280;font-style:italic;}
        .more-btn{background:transparent;border:1px solid #0F1E3A;color:#4A6280;padding:8px 16px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:13px;font-style:italic;cursor:pointer;margin-top:14px;width:100%;}
        .more-btn:hover{border-color:#4A6280;color:#F0F4FF;}
        .more-data{margin-top:14px;background:#050B18;border-radius:10px;padding:14px;}
        .more-row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #0F1E3A;font-size:13px;}
        .more-row:last-child{border-bottom:none;}
        .more-label{color:#4A6280;font-style:italic;flex-shrink:0;margin-right:12px;}
        .more-value{color:#F0F4FF;text-align:right;}
        .values-wrap{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
        .value-tag{background:#0D1B35;border:1px solid #0F2040;border-radius:20px;padding:4px 10px;font-size:11px;font-style:italic;color:#4F8EF7;}
        .success-msg{text-align:center;padding:16px;background:#0A1F0A;border:1px solid #1A4A1A;border-radius:10px;margin-top:16px;font-size:14px;color:#4F8EF7;font-style:italic;}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;}
        .modal{background:#070F22;border:1px solid #0F2040;border-radius:20px;padding:36px;max-width:420px;width:90%;text-align:center;}
        .modal-h{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:10px;}
        .modal-p{color:#4A6280;font-size:15px;font-style:italic;margin-bottom:28px;line-height:1.7;}
        .modal-actions{display:flex;gap:12px;justify-content:center;}
        .modal-cancel{background:transparent;border:1px solid #0F2040;color:#4A6280;padding:11px 20px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;cursor:pointer;}
        .modal-confirm{background:linear-gradient(135deg,#4F8EF7,#7C3AED);color:#fff;padding:11px 24px;border-radius:8px;font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;border:none;cursor:pointer;}
        @media(max-width:768px){
          .layout{grid-template-columns:1fr;padding:16px 20px;}
          .contact-header{padding:24px 20px 0;}
          .nav{padding:16px 20px;}
        }
      `}</style>

      <nav className="nav">
        <div className="logo">BrandSheet</div>
        <button className="back" onClick={() => window.location.href='/dashboard'}>← Mes contacts</button>
      </nav>

      <div className="contact-header">
        <h1 className="contact-title">{contact.brand_name || contact.name}</h1>
        <p className="contact-url">{contact.url}</p>
      </div>

      <div className="layout">
        <div className="col">
          <div className="panel">
            <div className="panel-h">Palette</div>
            {brand?.brand_colors?.length > 0 ? (
              <div className="colors">
                {brand.brand_colors.map((c: string, i: number) => (
                  <div key={i} className="color-wrap">
                    <div className="color-chip" style={{background: c}} title={c}></div>
                    <div className="color-hex">{c}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{fontSize:12,color:'#1E3050',fontStyle:'italic'}}>Lancez l'analyse</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-h">Polices</div>
            {brand?.brand_fonts?.length > 0 && brand.brand_fonts[0] !== null ? (
              brand.brand_fonts.map((f: string, i: number) => (
                <div key={i} className="font-item">{f}</div>
              ))
            ) : (
              <p style={{fontSize:12,color:'#1E3050',fontStyle:'italic'}}>Non détectées</p>
            )}
            {brand?.brand_tone && (
              <div style={{marginTop:12}}>
                <div className="panel-h">Ton</div>
                <span className="tone-badge">{brand.brand_tone}</span>
              </div>
            )}
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-h">Actions</div>
            <button className="action-btn action-primary" onClick={handleAnalyzeClick} disabled={analyzing}>
              <span>✦</span>
              {analyzing ? 'Analyse...' : brand ? 'Ré-analyser' : "Lancer l'analyse"}
            </button>
            <button className="action-btn action-secondary" onClick={() => { setOpError(null); setShowOpForm(true) }}>
              <span>+</span> Ajouter une opération
            </button>
          </div>

          <div className="panel">
            <div className="panel-h">Mes opérations</div>
            {operations.length === 0 ? (
              <p style={{fontSize:12,color:'#1E3050',fontStyle:'italic'}}>Aucune opération</p>
            ) : (
              operations.map((op) => {
                const selected = selectedOpId === op.id
                return (
                  <div
                    key={op.id}
                    className={`doc-item${selected ? ' doc-item-selected' : ''}`}
                    onClick={() => setSelectedOpId(selected ? null : op.id)}
                    style={{position:'relative',paddingRight:36}}
                  >
                    <div className="doc-item-left">
                      <span className="doc-icon">◈</span>
                      <div>
                        <div className="doc-label">{op.name}</div>
                        <div className="doc-status">{op.images?.length || 0} image{(op.images?.length || 0) > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <span className="doc-arrow">{selected ? '✓' : '→'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteOpConfirmed(false); setDeleteOpModal(op.id) }}
                      title="Supprimer l'opération"
                      style={{position:'absolute',top:6,right:6,background:'transparent',border:'none',color:'#1E3050',cursor:'pointer',fontSize:14,lineHeight:1,padding:4}}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#1E3050')}
                    >✕</button>
                  </div>
                )
              })
            )}
          </div>

          <div className="panel">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <div className="panel-h" style={{marginBottom:0}}>Historique</div>
              {docs.filter(d => d.operation_id).length > 0 && (
                <button
                  onClick={() => setHistoryFullscreen(true)}
                  title="Voir en plein écran"
                  style={{background:'transparent',border:'none',color:'#4A6280',cursor:'pointer',fontSize:13,fontStyle:'italic',fontFamily:"'Cormorant Garamond',serif",padding:0}}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#A8C8FC')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#4A6280')}
                >⛶ Plein écran</button>
              )}
            </div>
            <p style={{fontSize:11,color:'#4A6280',fontStyle:'italic',marginBottom:10}}>
              Plan <strong style={{color:'#A8C8FC'}}>{PLANS[plan].label}</strong> · conservation {PLANS[plan].retentionLabel}
            </p>
            {(() => {
              const visible = applyRetention(docs.filter(d => d.operation_id), plan)
              if (visible.length === 0) {
                return <p style={{fontSize:12,color:'#1E3050',fontStyle:'italic'}}>Aucun document généré pour ce contact.</p>
              }
              return visible.map((doc) => {
                const opName = operations.find(o => o.id === doc.operation_id)?.name || '—'
                return (
                  <div key={doc.id} className="doc-item" onClick={() => openViewer(doc)} style={{cursor:'pointer'}}>
                    <div className="doc-item-left">
                      <span className="doc-icon">◈</span>
                      <div>
                        <div className="doc-label">{docTypeLabels[doc.type] || doc.type}</div>
                        <div className="doc-status">{opName} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}</div>
                      </div>
                    </div>
                    <span className="doc-arrow">→</span>
                  </div>
                )
              })
            })()}
          </div>
        </div>

        <div className="col">
          <div className="main-panel">
            {analyzing ? (
              <div>
                <p className="analyzing-text">L'IA analyse le site...</p>
                <p className="analyzing-sub">Couleurs, typographies, ton éditorial</p>
              </div>
            ) : analyzeError ? (
              <div style={{textAlign:'center',maxWidth:420}}>
                <h2 className="main-panel-h" style={{color:'#F7954F'}}>Analyse impossible</h2>
                <p className="main-panel-p" style={{wordBreak:'break-word'}}>{analyzeError}</p>
                <button className="analyze-btn" onClick={handleAnalyze}>↻ Réessayer</button>
              </div>
            ) : brand ? (
              <div className="brand-result">
                <h2 className="brand-result-h">Branding <em>détecté</em></h2>
                <div className="colors">
                  {brand.brand_colors?.map((c: string, i: number) => (
                    <div key={i} className="color-wrap">
                      <div className="color-chip" style={{background: c, width:44, height:44}}></div>
                      <div className="color-hex">{c}</div>
                    </div>
                  ))}
                </div>
                <div className="info-grid">
                  <div className="info-card">
                    <div className="info-label">Secteur</div>
                    <div className="info-value">{brand.brand_sector || '—'}</div>
                  </div>
                  <div className="info-card">
                    <div className="info-label">Ton éditorial</div>
                    <div className="info-value">{brand.brand_tone || '—'}</div>
                  </div>
                  <div className="info-card">
                    <div className="info-label">Typographies</div>
                    <div className="info-value">{brand.brand_fonts?.filter(Boolean).join(', ') || '—'}</div>
                  </div>
                  <div className="info-card">
                    <div className="info-label">Marque</div>
                    <div className="info-value">{brand.brand_name || '—'}</div>
                  </div>
                </div>

                {brand.brand_values?.length > 0 && (
                  <div className="values-wrap">
                    {brand.brand_values.map((v: string, i: number) => (
                      <span key={i} className="value-tag">{v}</span>
                    ))}
                  </div>
                )}

                <button className="more-btn" onClick={() => setShowMoreData(!showMoreData)}>
                  {showMoreData ? '▲ Moins de données' : '▼ Voir plus de données'}
                </button>

                {showMoreData && (
                  <div className="more-data">
                    {brand.brand_description && (
                      <div className="more-row">
                        <span className="more-label">Description</span>
                        <span className="more-value">{brand.brand_description}</span>
                      </div>
                    )}
                    {brand.brand_email && (
                      <div className="more-row">
                        <span className="more-label">Email</span>
                        <span className="more-value">{brand.brand_email}</span>
                      </div>
                    )}
                    {brand.brand_phone && (
                      <div className="more-row">
                        <span className="more-label">Téléphone</span>
                        <span className="more-value">{brand.brand_phone}</span>
                      </div>
                    )}
                    {brand.brand_address && (
                      <div className="more-row">
                        <span className="more-label">Adresse</span>
                        <span className="more-value">{brand.brand_address}</span>
                      </div>
                    )}
                  </div>
                )}

                {generated && (
                  <div className="success-msg">✦ Tous les documents ont été générés !</div>
                )}

                <button className="generate-btn" onClick={handleGenerate} disabled={generating || !selectedOpId}>
                  {generating
                    ? '⏳ Génération en cours...'
                    : selectedOpId
                      ? '✦ Générer tous les documents →'
                      : 'Sélectionnez une opération'}
                </button>
                <p className="cost-hint">
                  {selectedOpId
                    ? <>Pour l'opération <strong style={{color:'#A8C8FC'}}>{operations.find(o => o.id === selectedOpId)?.name}</strong> · Coût : 10 crédits {typeof credits === 'number' && <>· solde {credits}</>}</>
                    : <>Cliquez une opération dans la barre latérale pour pouvoir générer.</>}
                </p>
              </div>
            ) : (
              <>
                <h2 className="main-panel-h">Analysez le branding</h2>
                <p className="main-panel-p">L'IA va analyser le site de votre client et extraire sa palette, ses polices et son identité.</p>
                <button className="analyze-btn" onClick={handleAnalyze}>✦ Lancer l'analyse →</button>
              </>
            )}
          </div>
        </div>
      </div>

      {showOpForm && (
        <div className="modal-overlay" onClick={() => !opSaving && setShowOpForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth:520}}>
            <h2 className="modal-h">Nouvelle opération</h2>
            <p className="modal-p" style={{textAlign:'left'}}>Ajoutez le contexte de la prestation pour générer des documents adaptés. Le branding du contact sera réutilisé.</p>

            <label className="panel-h" style={{display:'block',marginTop:8,marginBottom:6}}>Nom de l'opération</label>
            <input
              className="modal-input"
              placeholder="Lancement collection été"
              value={opForm.name}
              onChange={(e) => setOpForm({...opForm, name: e.target.value})}
              disabled={opSaving}
            />

            <label className="panel-h" style={{display:'block',marginTop:8,marginBottom:6}}>Description / contexte</label>
            <textarea
              className="modal-input"
              placeholder="Type de produit, public visé, ton souhaité, particularités..."
              value={opForm.description}
              onChange={(e) => setOpForm({...opForm, description: e.target.value})}
              disabled={opSaving}
              rows={4}
              style={{resize:'vertical',minHeight:90,fontFamily:"'Cormorant Garamond',serif"}}
            />

            <label className="panel-h" style={{display:'block',marginTop:8,marginBottom:6}}>Visuels produit (logo, photos, miniatures...)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={opSaving}
              onChange={(e) => setOpForm({...opForm, files: Array.from(e.target.files || [])})}
              style={{width:'100%',background:'#050B18',border:'1px solid #0F2040',borderRadius:10,padding:10,color:'#6B84AA',fontFamily:"'Cormorant Garamond',serif",fontSize:13,marginBottom:8}}
            />
            {opForm.files.length > 0 && (
              <p style={{fontSize:12,color:'#4F8EF7',fontStyle:'italic',marginBottom:12}}>
                {opForm.files.length} fichier{opForm.files.length > 1 ? 's' : ''} sélectionné{opForm.files.length > 1 ? 's' : ''}
              </p>
            )}

            {opError && (
              <p style={{fontSize:13,color:'#F7954F',fontStyle:'italic',padding:10,background:'#1A0F08',border:'1px solid #3A2010',borderRadius:8,marginBottom:12,wordBreak:'break-word'}}>{opError}</p>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowOpForm(false)} disabled={opSaving}>Annuler</button>
              <button className="modal-confirm" onClick={handleCreateOperation} disabled={opSaving}>
                {opSaving ? 'Création...' : 'Créer l\'opération →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerDoc && (
        <div className="modal-overlay" onClick={closeViewer} style={{padding:0}}>
          <div onClick={(e) => e.stopPropagation()} style={{background:'#070F22',border:'1px solid #0F2040',borderRadius:14,width:'min(1100px,95vw)',height:'90vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #0F2040',gap:12,flexWrap:'wrap'}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>{docTypeLabels[viewerDoc.type] || viewerDoc.type}</div>
                <div style={{fontSize:12,color:'#4A6280',fontStyle:'italic'}}>{operations.find(o => o.id === viewerDoc.operation_id)?.name || '—'} · {new Date(viewerDoc.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {!isEditing ? (
                  <button onClick={toggleEdit} disabled={isRegen || isSavingDoc} style={{background:'#0D1B35',border:'1px solid #0F2040',color:'#F0F4FF',padding:'9px 16px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:'italic',cursor:'pointer'}}>✎ Éditer le texte</button>
                ) : (
                  <>
                    <button onClick={saveDocEdits} disabled={isSavingDoc} style={{background:'linear-gradient(135deg,#4F8EF7,#7C3AED)',border:'none',color:'#fff',padding:'9px 16px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:'italic',cursor:'pointer'}}>{isSavingDoc ? 'Sauvegarde...' : '✓ Sauvegarder'}</button>
                    <button onClick={toggleEdit} disabled={isSavingDoc} style={{background:'transparent',border:'1px solid #0F2040',color:'#4A6280',padding:'9px 16px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:'italic',cursor:'pointer'}}>Annuler</button>
                  </>
                )}
                {plan !== 'starter' && !isEditing && (
                  <button onClick={regenerateDoc} disabled={isRegen} style={{background:'#0D1B35',border:'1px solid #0F2040',color:'#A8C8FC',padding:'9px 16px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:'italic',cursor:'pointer'}}>{isRegen ? '⟳ Régénération...' : '⟳ Régénérer (2 crédits)'}</button>
                )}
                <button onClick={() => handleDownloadDoc(viewerDoc)} disabled={isEditing} style={{background:'#0D1B35',border:'1px solid #0F2040',color:'#F0F4FF',padding:'9px 16px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:'italic',cursor:isEditing?'not-allowed':'pointer',opacity:isEditing?0.5:1}}>↓ Télécharger</button>
                <button onClick={closeViewer} style={{background:'transparent',border:'1px solid #0F2040',color:'#4A6280',padding:'9px 14px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:'italic',cursor:'pointer'}}>✕</button>
              </div>
            </div>
            {docError && (
              <div style={{padding:'10px 20px',background:'#1A0F08',borderBottom:'1px solid #3A2010',color:'#F7954F',fontSize:13,fontStyle:'italic'}}>{docError}</div>
            )}
            <iframe
              ref={viewerIframeRef}
              srcDoc={viewerDoc.content || '<p style="padding:40px;font-family:sans-serif;">Document vide</p>'}
              sandbox="allow-same-origin allow-scripts"
              style={{flex:1,width:'100%',border:'none',background:'#f4f4f7'}}
              title={viewerDoc.type}
            />
            {plan === 'starter' && !isEditing && (
              <div style={{padding:'10px 20px',borderTop:'1px solid #0F2040',fontSize:12,color:'#4A6280',fontStyle:'italic',textAlign:'center'}}>
                La régénération automatique est réservée aux plans payants. <a onClick={() => window.location.href='/dashboard/credits'} style={{color:'#A8C8FC',cursor:'pointer'}}>Voir les plans →</a>
              </div>
            )}
          </div>
        </div>
      )}

      {historyFullscreen && (
        <div style={{position:'fixed',inset:0,background:'#050B18',zIndex:200,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 32px',borderBottom:'1px solid #0F2040'}}>
            <div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,margin:0}}>
                Historique — <span style={{fontStyle:'italic',background:'linear-gradient(135deg,#4F8EF7,#7C3AED)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{contact.brand_name || contact.name}</span>
              </h2>
              <p style={{fontSize:13,color:'#4A6280',fontStyle:'italic',marginTop:4}}>
                Plan <strong style={{color:'#A8C8FC'}}>{PLANS[plan].label}</strong> · conservation {PLANS[plan].retentionLabel}
              </p>
            </div>
            <button onClick={() => setHistoryFullscreen(false)} style={{background:'transparent',border:'1px solid #0F2040',color:'#4A6280',padding:'10px 18px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontStyle:'italic',cursor:'pointer'}}>✕ Fermer</button>
          </div>
          <div style={{flex:1,overflow:'auto',padding:32}}>
            {(() => {
              const visible = applyRetention(docs.filter(d => d.operation_id), plan)
              if (visible.length === 0) {
                return <p style={{fontSize:14,color:'#1E3050',fontStyle:'italic',textAlign:'center',marginTop:80}}>Aucun document généré pour ce contact.</p>
              }
              return (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16,maxWidth:1200,margin:'0 auto'}}>
                  {visible.map((doc) => {
                    const opName = operations.find(o => o.id === doc.operation_id)?.name || '—'
                    return (
                      <div
                        key={doc.id}
                        onClick={() => { setHistoryFullscreen(false); openViewer(doc) }}
                        style={{background:'#070F22',border:'1px solid #0F2040',borderRadius:14,padding:20,cursor:'pointer',transition:'border-color .2s'}}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4F8EF7')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#0F2040')}
                      >
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,marginBottom:6}}>{docTypeLabels[doc.type] || doc.type}</div>
                        <div style={{fontSize:13,color:'#4A6280',fontStyle:'italic',marginBottom:14}}>{opName}</div>
                        <div style={{fontSize:12,color:'#1E3050',display:'flex',justifyContent:'space-between'}}>
                          <span>{new Date(doc.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}</span>
                          <span style={{color:'#4F8EF7'}}>→ Ouvrir</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {deleteOpModal && (
        <div className="modal-overlay" onClick={() => setDeleteOpModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-h">Supprimer cette opération ?</h2>
            <p className="modal-p" style={{textAlign:'left',color:'#F7954F',padding:12,background:'#1A0F08',borderRadius:8,border:'1px solid #3A2010',marginBottom:20}}>
              ⚠️ Action irréversible. Tous les documents générés pour cette opération seront définitivement supprimés.
            </p>
            <label style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0',cursor:'pointer',fontSize:15,color:'#6B84AA',fontStyle:'italic'}}>
              <input type="checkbox" checked={deleteOpConfirmed} onChange={(e) => setDeleteOpConfirmed(e.target.checked)} style={{width:16,height:16,cursor:'pointer'}} />
              Je comprends que ces données ne seront pas récupérables
            </label>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setDeleteOpModal(null)}>Annuler</button>
              <button
                onClick={handleDeleteOperation}
                disabled={!deleteOpConfirmed}
                style={{background: deleteOpConfirmed ? '#dc2626' : '#1E3050', color:'#fff', cursor: deleteOpConfirmed ? 'pointer' : 'not-allowed', padding:'11px 24px',borderRadius:8,fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontStyle:'italic',border:'none'}}
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {showReanalyzeConfirm && (
        <div className="modal-overlay" onClick={() => setShowReanalyzeConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-h">Ré-analyser ?</h2>
            <p className="modal-p">Le branding actuel sera remplacé par la nouvelle analyse. Les documents déjà générés ne seront pas affectés.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowReanalyzeConfirm(false)}>Annuler</button>
              <button className="modal-confirm" onClick={handleAnalyze}>Confirmer →</button>
            </div>
          </div>
        </div>
      )}

      {showNoCredits && (
        <div className="modal-overlay" onClick={() => setShowNoCredits(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-h">Crédits insuffisants</h2>
            <p className="modal-p">
              Il vous reste <strong>{credits ?? 0} crédits</strong>.<br />
              Une génération complète en coûte 10. Rechargez votre solde pour continuer.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowNoCredits(false)}>Plus tard</button>
              <button className="modal-confirm" onClick={() => window.location.href='/dashboard/credits'}>Recharger →</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}