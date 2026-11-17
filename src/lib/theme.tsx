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
