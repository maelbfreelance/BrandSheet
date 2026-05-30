'use client'
import React from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<'night' | 'day'>('night')

  React.useEffect(() => {
    const saved = localStorage.getItem('bs-theme') as 'night' | 'day' | null
    if (saved === 'day' || saved === 'night') setTheme(saved)
  }, [])

  React.useEffect(() => {
    document.body.classList.toggle('bs-day', theme === 'day')
    localStorage.setItem('bs-theme', theme)
  }, [theme])

  const next = theme === 'night' ? 'day' : 'night'
  const label = theme === 'night' ? 'Passer en mode jour' : 'Passer en mode nuit'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '1px solid var(--border-2)',
        background: 'var(--bg-elev)',
        color: 'var(--text-strong)',
        cursor: 'pointer',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
        fontSize: 15,
        lineHeight: 1,
        boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <span aria-hidden>{theme === 'night' ? '☀️' : '🌙'}</span>
    </button>
  )
}
