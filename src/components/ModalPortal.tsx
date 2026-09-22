import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza janelas direto no <body>.
 * Sem isso, uma janela aberta de dentro do cabeçalho (que tem backdrop-blur)
 * fica presa a ele pelo CSS e aparece cortada/descentralizada.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
