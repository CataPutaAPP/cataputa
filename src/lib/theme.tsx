import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Tema claro ou escuro, escolhido pelo usuário e salvo no aparelho.
 * O escuro é o padrão da marca. As cores de cada tema ficam em styles.css (html.light).
 */
export type Tema = "dark" | "light";
const CHAVE = "privora-tema";
const EVENTO = "privora-tema-mudou";

export function temaSalvo(): Tema {
  try { return localStorage.getItem(CHAVE) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

export function aplicarTema(t: Tema) {
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  html.classList.add(t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#F6EDDE" : "#1E0E1A");
}

export function setTema(t: Tema) {
  try { localStorage.setItem(CHAVE, t); } catch { /* aparelho sem armazenamento: vale só nesta visita */ }
  aplicarTema(t);
  window.dispatchEvent(new Event(EVENTO));
}

export function useTema(): Tema {
  const [tema, setT] = useState<Tema>("dark");
  useEffect(() => {
    const ler = () => { const t = temaSalvo(); aplicarTema(t); setT(t); };
    ler();
    window.addEventListener(EVENTO, ler);
    window.addEventListener("storage", ler);
    return () => { window.removeEventListener(EVENTO, ler); window.removeEventListener("storage", ler); };
  }, []);
  return tema;
}

/**
 * Cores do tema claro. Ficam aqui (e não no styles.css) para irem junto com o código do tema:
 * mesma paleta da marca invertida — fundo Ivory, texto e destaque em Deep Plum.
 */
export const CSS_TEMA_CLARO =
  "html.light { color-scheme: light; --background: #F6EDDE; --foreground: #2A1425; --card: #FFFAF1; --card-foreground: #2A1425; --popover: #FFFAF1; --popover-foreground: #2A1425; --primary: #3F1D36; --primary-foreground: #F6EDDE; --secondary: #EADCC8; --secondary-foreground: #2A1425; --muted: #EFE3D0; --muted-foreground: #6B5563; --accent: #B17078; --accent-foreground: #1E0E1A; --destructive: #A83246; --destructive-foreground: #F6EDDE; --success: #4F7A4A; --success-foreground: #F6EDDE; --border: rgba(42, 20, 37, 0.14); --input: rgba(42, 20, 37, 0.22); --ring: #3F1D36; --chart-1: #3F1D36; --chart-2: #B17078; --chart-3: #8A6A3E; --chart-4: #4C5051; --chart-5: #4F7A4A; --map-base: #EDE3D3; --map-line: #D9CBB6; --map-road: #B9A088; --map-block: #E4D8C5; --map-pulse: rgba(63, 29, 54, 0.18); --bgmap-base: #EFE4D2; --bgmap-b1: #E6D9C3; --bgmap-b2: #EADFCB; --bgmap-water: #C9D6E2; --bgmap-road: #D2BFA6; --bgmap-road2: #DCCBB4; --shadow-glow: 0 18px 50px -20px rgba(63, 29, 54, 0.35); --shadow-panel: 0 24px 60px -34px rgba(42, 20, 37, 0.45); } html.light .text-green-400 { color: #2F7A3F; } html.light .text-yellow-400, html.light .text-yellow-500 { color: #9A6400; } html.light .fill-yellow-500 { fill: #C98A00; } html.light .text-red-400 { color: #B3261E; } html.light .sh-dark-tiles .leaflet-tile-pane { filter: saturate(0.7) sepia(0.12); } html.light .sh-dark-tiles .leaflet-container { background: #EDE3D3 !important; } html.light .dark-popup .leaflet-popup-content-wrapper { background: #FFFAF1; color: #2A1425; border: 1px solid rgba(42, 20, 37, 0.18); box-shadow: 0 8px 28px rgba(42, 20, 37, 0.25); } html.light .dark-popup .leaflet-popup-tip { background: #FFFAF1; border: 1px solid rgba(42, 20, 37, 0.18); }";

/** Código que roda antes da tela aparecer, para não piscar no tema errado. */
export const SCRIPT_TEMA =
  `try{if(localStorage.getItem("${CHAVE}")==="light"){var h=document.documentElement;h.classList.remove("dark");h.classList.add("light");}}catch(e){}`;

/** Botão sol/lua do cabeçalho. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const tema = useTema();
  const claro = tema === "light";
  return (
    <button type="button" onClick={() => setTema(claro ? "dark" : "light")}
      aria-label={claro ? "Usar tema escuro" : "Usar tema claro"} title={claro ? "Tema escuro" : "Tema claro"}
      className={`flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-secondary ${className}`}>
      {claro ? <Moon className="size-5" /> : <Sun className="size-5" />}
    </button>
  );
}
