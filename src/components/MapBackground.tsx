export function MapBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <svg className="h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 700">
        <rect width="400" height="700" fill="var(--map-base)" />
        <g stroke="var(--map-line)" strokeWidth="1.2">
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={`h${i}`} x1="0" x2="400" y1={i * 52 + 10} y2={i * 52 + 26} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`v${i}`} y1="0" y2="700" x1={i * 44 + 12} x2={i * 44 - 4} />
          ))}
        </g>
        <path
          d="M-10 180 L140 210 L200 400 L370 470"
          stroke="var(--map-road)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M60 -10 L100 260 L250 520 L280 720"
          stroke="var(--map-road)"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="var(--map-block)">
          <rect x="30" y="60" width="70" height="50" rx="6" />
          <rect x="230" y="120" width="90" height="70" rx="6" />
          <rect x="60" y="430" width="80" height="60" rx="6" />
          <rect x="290" y="560" width="70" height="60" rx="6" />
        </g>
        <circle cx="200" cy="400" r="26" fill="var(--map-pulse)" />
        <circle cx="200" cy="400" r="9" fill="var(--color-primary)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
    </div>
  );
}
