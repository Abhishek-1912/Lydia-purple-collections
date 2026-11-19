export function Lotus({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="currentColor">
        <path d="M32 8c6 8 8 16 0 30-8-14-6-22 0-30z" />
        <path d="M14 22c10 2 16 8 18 16-10-1-17-6-18-16z" />
        <path d="M50 22c-10 2-16 8-18 16 10-1 17-6 18-16z" />
        <path d="M6 36c10-2 20 1 26 6-10 4-20 2-26-6z" />
        <path d="M58 36c-10-2-20 1-26 6 10 4 20 2 26-6z" />
      </g>
      <path d="M10 48h44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Mandala({ className }) {
  const petals = Array.from({ length: 16 }, (_, i) => i * 22.5)
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="100" cy="100" r="96" strokeDasharray="3 4" />
        <circle cx="100" cy="100" r="80" />
        <circle cx="100" cy="100" r="34" />
        <circle cx="100" cy="100" r="14" />
        {petals.map((a) => (
          <g key={a} transform={`rotate(${a} 100 100)`}>
            <path d="M100 20 C112 40 112 58 100 66 C88 58 88 40 100 20z" />
            <circle cx="100" cy="12" r="3" />
          </g>
        ))}
        {petals.map((a) => (
          <path key={'i' + a} transform={`rotate(${a + 11.25} 100 100)`} d="M100 66 C106 74 106 80 100 86 C94 80 94 74 100 66z" />
        ))}
      </g>
    </svg>
  )
}

export function WhatsAppIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z" />
    </svg>
  )
}

export function BagIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

export function UserIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />
    </svg>
  )
}

export function MenuIcon({ size = 24, open }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  )
}
