import { useCallback, useEffect, useState } from "react";

const CHAVE = "privora:discreto";

export const DISCRETO = {
  titulo: "Agenda",
  favicon: "/neutro-favicon.png",
  manifest: "/manifest-discreto.webmanifest",
};
const PADRAO = {
  titulo: "Privora Private Club",
  favicon: "/favicon.png",
  manifest: "/manifest.webmanifest",
};

function aplicar(ligado: boolean) {
  if (typeof document === "undefined") return;
  const cfg = ligado ? DISCRETO : PADRAO;
  document.title = cfg.titulo;
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) icon.href = cfg.favicon;
  const man = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (man) man.href = cfg.manifest;          // define o nome/ícone na instalação
  document.documentElement.dataset["discreto"] = ligado ? "1" : "0";
}

/**
 * Modo discreto (recurso do Privora Pass).
 * Troca nome, ícone e o que é usado ao instalar o app na tela inicial.
 * A preferência é do aparelho — some se a pessoa entrar de outro celular.
 */
export function useDiscreet(liberado: boolean) {
  const [ligado, setLigado] = useState(false);

  useEffect(() => {
    const salvo = typeof localStorage !== "undefined" && localStorage.getItem(CHAVE) === "1";
    const valor = salvo && liberado;      // perdeu o plano → volta ao normal
    setLigado(valor);
    aplicar(valor);
  }, [liberado]);

  const alternar = useCallback((valor: boolean) => {
    setLigado(valor);
    try { localStorage.setItem(CHAVE, valor ? "1" : "0"); } catch { /* modo anônimo */ }
    aplicar(valor);
  }, []);

  return { ligado, alternar };
}

/** Cobre a tela quando o app sai de foco (alguém olhando por cima do ombro). */
export function usePrivacyBlur(ligado: boolean) {
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    if (!ligado) { setOculto(false); return; }
    const aoTrocar = () => setOculto(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", aoTrocar);
    window.addEventListener("blur", () => setOculto(true));
    window.addEventListener("focus", () => setOculto(false));
    return () => {
      document.removeEventListener("visibilitychange", aoTrocar);
    };
  }, [ligado]);
  return oculto;
}
