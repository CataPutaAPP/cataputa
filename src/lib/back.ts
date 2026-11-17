import { useEffect, useRef } from "react";

/**
 * Botão "voltar" do celular / navegador fecha a tela aberta em vez de sair do app.
 *
 * Uso:  useBackClose(aberto, fechar)
 *
 * Como funciona:
 *  - Existe UMA entrada extra no histórico (a "guarda") enquanto houver qualquer tela aberta.
 *  - "Voltar" consome a guarda e fecha a tela de cima; se sobrar tela aberta, a guarda é recolocada.
 *  - Fechar pelo X só tira a tela da pilha. O histórico é acertado logo depois, uma única vez.
 *
 * Por que assim: antes, cada tela empilhava e desempilhava a própria entrada. Quando uma tela
 * fechava e outra abria no mesmo instante (aviso → histórico, pedido → propostas), o "voltar"
 * da primeira desfazia a entrada da segunda, o histórico ficava uma casa atrás e o próximo
 * fechamento tirava o usuário do app, de volta para a entrada/login.
 */
const pilha: Array<() => void> = [];
let temGuarda = false;        // a entrada extra está no histórico?
let voltando = false;         // estamos esperando o resultado de um history.back() nosso?
let agendado = false;
let ligado = false;

const naGuarda = () => !!(window.history.state as { __guarda?: boolean } | null)?.__guarda;

/** Deixa o histórico de acordo com a pilha. Roda depois que a tela terminou de abrir/fechar. */
function acertar() {
  agendado = false;
  if (voltando) return;                       // o popstate chama de novo quando terminar
  if (pilha.length > 0 && !temGuarda) {
    window.history.pushState({ ...(window.history.state ?? {}), __guarda: true }, "");
    temGuarda = true;
  } else if (pilha.length === 0 && temGuarda) {
    // só volta se ainda estamos em cima da guarda; se o app já navegou para outra página, deixa como está
    if (naGuarda()) { voltando = true; window.history.back(); }
    else temGuarda = false;
  }
}

function agendar() {
  if (agendado) return;
  agendado = true;
  setTimeout(acertar, 0);
}

function ligar() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  window.addEventListener("popstate", () => {
    if (voltando) {                           // foi o nosso próprio "voltar": só acerta as contas
      voltando = false;
      temGuarda = false;
      agendar();
      return;
    }
    if (!temGuarda) return;                   // navegação normal entre páginas: não é com a gente
    temGuarda = false;                        // o usuário apertou "voltar": a guarda foi consumida
    const topo = pilha.pop();
    if (topo) topo();
    agendar();                                // se ainda há tela aberta, recoloca a guarda
  });
}

export function useBackClose(aberto: boolean, fechar: () => void) {
  const ref = useRef(fechar);
  ref.current = fechar;

  useEffect(() => {
    if (!aberto || typeof window === "undefined") return;
    ligar();
    const entrada = () => ref.current();
    pilha.push(entrada);
    agendar();
    return () => {
      const i = pilha.indexOf(entrada);
      if (i >= 0) pilha.splice(i, 1);         // i < 0: já saiu pelo "voltar"
      agendar();
    };
  }, [aberto]);
}
