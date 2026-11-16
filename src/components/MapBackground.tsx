/**
 * Fundo das telas de entrada: um mapa estilizado que mostra o que o app faz —
 * você no centro, o radar de busca, ofertas por perto (pontos) e locais
 * parceiros (pontos com letra). É só ilustração: nenhum dado real.
 */
const QUADRAS = Array.from({ length: 19 }).flatMap((_, j) =>
  Array.from({ length: 10 }).map((__, i) => ({ i, j })),
).filter(({ i, j }) => (i * 7 + j * 13) % 11 !== 0); // alguns vazios viram praça/rua larga

const OFERTAS: { x: number; y: number; cor: string; r?: number }[] = [
  { x: 118, y: 262, cor: "#e879a6" }, { x: 286, y: 300, cor: "#e879a6" }, { x: 246, y: 452, cor: "#e879a6" },
  { x: 92, y: 420, cor: "#e879a6" }, { x: 318, y: 418, cor: "#22c55e" }, { x: 158, y: 498, cor: "#22c55e" },
  { x: 236, y: 232, cor: "#eab308", r: 6.5 }, { x: 62, y: 330, cor: "#e879a6" }, { x: 338, y: 512, cor: "#e879a6" },
];
const PARCEIROS = [
  { x: 150, y: 318, letra: "M" }, { x: 292, y: 366, letra: "H" }, { x: 196, y: 548, letra: "C" }, { x: 78, y: 214, letra: "Ψ" },
];

export function MapBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg className="h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 700">
        <rect width="400" height="700" fill="#160a13" />

        {/* quadras da cidade, levemente giradas */}
        <g transform="rotate(-9 200 350)">
          {QUADRAS.map(({ i, j }) => (
            <rect key={`${i}-${j}`} x={i * 56 - 80} y={j * 44 - 70} width="48" height="36" rx="5"
              fill={(i + j) % 6 === 0 ? "#1c1a15" : "#22101f"} />
          ))}
        </g>

        {/* rio e avenidas */}
        <path d="M-20 610 C 90 560, 150 640, 250 600 S 380 520, 430 560" stroke="#161b2a" strokeWidth="30" fill="none" strokeLinecap="round" />
        <path d="M-10 170 L130 205 L205 380 L410 455" stroke="#3a2233" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M70 -10 L104 250 L250 520 L282 720" stroke="#33202e" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M410 120 L250 232 L205 380" stroke="#33202e" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* rota até um local parceiro */}
        <path d="M205 380 L176 345 L150 318" stroke="#D8B890" strokeOpacity="0.55" strokeWidth="2.5" strokeDasharray="5 6" fill="none" strokeLinecap="round" />

        {/* radar de busca */}
        <g fill="none" stroke="#D8B890">
          <circle cx="205" cy="380" r="70" strokeOpacity="0.16" />
          <circle cx="205" cy="380" r="130" strokeOpacity="0.11" />
          <circle cx="205" cy="380" r="195" strokeOpacity="0.07" />
          <circle cx="205" cy="380" r="12" strokeOpacity="0.5" strokeWidth="1.5">
            <animate attributeName="r" from="12" to="195" dur="4.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" from="0.5" to="0" dur="4.5s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* ofertas por perto */}
        {OFERTAS.map((o, n) => (
          <g key={n}>
            <circle cx={o.x} cy={o.y} r={(o.r ?? 5) + 5} fill={o.cor} opacity="0.18" />
            <circle cx={o.x} cy={o.y} r={o.r ?? 5} fill={o.cor} stroke="rgba(255,255,255,.85)" strokeWidth="1.3" />
          </g>
        ))}

        {/* locais parceiros (M motel, H hotel, C clínica, Ψ swing) */}
        {PARCEIROS.map((p) => (
          <g key={p.letra}>
            <circle cx={p.x} cy={p.y} r="10" fill="#a855f7" stroke="rgba(255,255,255,.9)" strokeWidth="1.4" />
            <text x={p.x} y={p.y + 3.6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{p.letra}</text>
          </g>
        ))}

        {/* você */}
        <circle cx="205" cy="380" r="16" fill="#D8B890" opacity="0.2" />
        <circle cx="205" cy="380" r="7" fill="#D8B890" stroke="#160a13" strokeWidth="2" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/15 to-background/90" />
    </div>
  );
}
