import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Notificacao = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

const ICONE: Record<string, string> = {
  proposta_aceita: "✅",
  prestador_a_caminho: "🚗",
  prestador_chegou: "📍",
  cliente_no_local: "🙋",
  servico_iniciado: "▶️",
  servico_concluido: "🏁",
  servico_cancelado: "⚠️",
  avaliacao_recebida: "⭐",
  parceria_nova: "🏠",
};

function quando(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [marcando, setMarcando] = useState(false);
  const painelRef = useRef<HTMLDivElement | null>(null);

  const naoLidas = itens.filter((n) => !n.read).length;

  const buscar = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setItens(data as Notificacao[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    buscar();
    const t = setInterval(buscar, 20000);
    return () => clearInterval(t);
  }, [user, buscar]);

  // Fecha ao tocar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function marcarTodasLidas() {
    if (!user || naoLidas === 0) return;
    setMarcando(true);
    await supabase.rpc("mark_notifications_read", { p_user_id: user.id, p_ids: null });
    setItens((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarcando(false);
  }

  if (!user) return null;

  return (
    <div className="relative" ref={painelRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={naoLidas > 0 ? `${naoLidas} avisos não lidos` : "Avisos"}
        onClick={() => { setAberto((v) => !v); if (!aberto) buscar(); }}
      >
        <Bell className="size-5" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-primary-foreground">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      {aberto && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[60vh] w-[min(78vw,300px)] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Avisos</p>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                disabled={marcando}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {marcando ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Marcar lidas
              </button>
            )}
          </div>

          {itens.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum aviso por aqui.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {itens.map((n) => (
                <li
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 ${n.read ? "" : "bg-primary/5"}`}
                >
                  <span className="text-lg leading-none">{ICONE[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-sm ${n.read ? "font-medium" : "font-semibold"}`}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {quando(n.created_at)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
