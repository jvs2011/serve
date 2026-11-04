export function Logo({ size = 28, light }: { size?: number; light?: boolean }) {
  return (
    <span className="logo" style={{ fontSize: size, color: light ? '#fff' : 'var(--ink)' }}>
      serve<span className="logo-dot">.</span>
    </span>
  )
}
