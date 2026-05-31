export default function SiteFooter() {
  return (
    <footer
      style={{
        padding: '24px 32px',
        borderTop: '1px solid var(--border-soft)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        fontFamily: "'Cormorant Garamond', serif",
        background: 'var(--bg-deep)',
        marginTop: 'auto',
      }}
    >
      <a
        href="/"
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 16,
          fontWeight: 700,
          background: 'linear-gradient(135deg,#4F8EF7,#7C3AED)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textDecoration: 'none',
        }}
      >
        BrandSheet
      </a>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-faint)',
          fontStyle: 'italic',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span>© 2026 BrandSheet</span>
        <span>·</span>
        <a href="/cgu" style={{ color: 'inherit', textDecoration: 'underline' }}>CGU</a>
        <span>·</span>
        <a href="/cgu" style={{ color: 'inherit', textDecoration: 'underline' }}>Mentions légales</a>
        <span>·</span>
        <a href="/blog" style={{ color: 'inherit', textDecoration: 'underline' }}>Blog</a>
        <span>·</span>
        <a href="/pricing" style={{ color: 'inherit', textDecoration: 'underline' }}>Tarifs</a>
        <span>·</span>
        <a href="mailto:maelbfreelance@gmail.com" style={{ color: 'inherit', textDecoration: 'underline' }}>Contact</a>
      </div>
    </footer>
  )
}
