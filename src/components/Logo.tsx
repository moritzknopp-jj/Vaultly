interface Props {
  size?: number
  className?: string
}

export default function Logo({ size = 32, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
    >
      <circle cx="50" cy="50" r="50" fill="#0a0a0a" />
      <circle cx="50" cy="50" r="43" stroke="#d4af37" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="29" stroke="#d4af37" strokeWidth="2" />
      <line x1="50" y1="7" x2="50" y2="21" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="79" x2="50" y2="93" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <line x1="7" y1="50" x2="21" y2="50" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <line x1="79" y1="50" x2="93" y2="50" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <line x1="19.6" y1="19.6" x2="29.5" y2="29.5" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <line x1="70.5" y1="70.5" x2="80.4" y2="80.4" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <line x1="80.4" y1="19.6" x2="70.5" y2="29.5" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <line x1="29.5" y1="70.5" x2="19.6" y2="80.4" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="50" r="11" fill="#d4af37" />
      <circle cx="50" cy="47" r="4" fill="#0a0a0a" />
      <path d="M47.5 49.5 L50 58 L52.5 49.5 Z" fill="#0a0a0a" />
    </svg>
  )
}
