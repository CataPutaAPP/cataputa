import { useEffect, useRef } from "react";

/**
 * Botão "voltar" do celular / navegador fecha a tela aberta em vez de sair do app.
 *
 * Uso:  useBackClose(aberto, fechar)
 *  - Ao abrir, empilha uma entrada no histórico (mesma URL).
 *  - "Voltar" chama fechar() da tela que está por cima.
 *  - Fechar pelo X desfaz a entrada, então o histórico nunca acumula lixo.
 * Uma pilha única para o app inteiro garante que cada "voltar" fecha só uma camada.
 */
const pilha: Array<() => void> = [];
let ignorar = 0;
let ligado = false;

function ligar() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  window.addEventListener("popstate", () => {
    if (ignorar > 0) { ignorar -= 1; return; }
    const topo = pilha.pop();
    if (topo) topo();
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
    window.history.pushState({ ...(window.history.state ?? {}), __camada: pilha.length }, "");
    return () => {
      const i = pilha.indexOf(entrada);
      if (i < 0) return; // já saiu pelo "voltar"
      pilha.splice(i, 1);
      ignorar += 1;
      window.history.back();
    };
  }, [aberto]);
}
