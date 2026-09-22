import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function base64ParaUint8(base64: string): BufferSource {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

interface StatusPush { aparelhos: number; chave_publica: string | null; ligado: boolean }

/**
 * Avisos com o app fechado.
 * O navegador só aceita o pedido de permissão a partir de um toque do usuário,
 * por isso "ativar" é sempre uma ação explícita, nunca automática.
 */
export function usePush() {
  const [status, setStatus] = useState<StatusPush | null>(null);
  const [inscrito, setInscrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const suportado = typeof window !== "undefined"
    && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const carregar = useCallback(async () => {
    if (!suportado) return;
    const { data } = await supabase.rpc("my_push_status");
    setStatus(data as StatusPush);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setInscrito(!!sub);
  }, [suportado]);
  useEffect(() => { carregar(); }, [carregar]);

  const ativar = useCallback(async (): Promise<string | null> => {
    if (!suportado) return "Seu navegador não aceita avisos. No iPhone, instale o app na tela inicial primeiro.";
    if (!status?.chave_publica) return "Os avisos ainda não foram configurados pela Privora.";

    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") return "Você recusou os avisos. Dá para liberar nas configurações do navegador.";

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaUint8(status.chave_publica),
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth,
        p_user_agent: navigator.userAgent,
      });
      if (error) return error.message;
      setInscrito(true);
      carregar();
      return null;
    } catch (e) {
      return `Não foi possível ativar: ${(e as Error).message}`;
    } finally {
      setOcupado(false);
    }
  }, [suportado, status, carregar]);

  const desativar = useCallback(async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setInscrito(false);
      carregar();
    } finally { setOcupado(false); }
  }, [carregar]);

  return { suportado, inscrito, ocupado, configurado: !!status?.chave_publica, ativar, desativar };
}
