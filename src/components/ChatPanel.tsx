import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/ReportButton";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ModalPortal } from "@/components/ModalPortal";

interface ThreadInfo {
  proposal_id: string; request_id: string; other_id: string; other_name: string | null;
  can_write: boolean; reason: string | null; accepted: boolean;
}
interface Msg { id: string; sender_id: string; body: string; was_masked: boolean; created_at: string; read_at: string | null }

/**
 * Conversa de uma proposta (cliente ↔ prestador).
 * Regras de quem pode escrever, máscara de contatos e anti-spam ficam no banco (send_message).
 */
export function ChatPanel({ proposalId, onClose }: { proposalId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<ThreadInfo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  // onClose vem como função nova a cada render do pai; guardar em ref evita recarregar o chat à toa
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(async () => {
    const [{ data: i, error }, { data: m }] = await Promise.all([
      supabase.rpc("chat_thread_info", { p_proposal_id: proposalId }),
      supabase.from("chat_messages").select("id, sender_id, body, was_masked, created_at, read_at")
        .eq("proposal_id", proposalId).order("created_at"),
    ]);
    if (error) { toast.error(error.message); onCloseRef.current(); return; }
    setInfo(i as ThreadInfo);
    setMsgs((m as Msg[]) ?? []);
    supabase.rpc("mark_chat_read", { p_proposal_id: proposalId });
  }, [proposalId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`chat-${proposalId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `proposal_id=eq.${proposalId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user?.id) supabase.rpc("mark_chat_read", { p_proposal_id: proposalId });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proposalId, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.rpc("send_message", { p_proposal_id: proposalId, p_body: body });
    setSending(false);
    if (error) { toast.error(error.message); load(); return; }
    setText("");
    if ((data as { was_masked?: boolean })?.was_masked) {
      toast("Contatos e links foram ocultados. Combine tudo por aqui.", { icon: "🔒" });
    }
    load();
  }

  const fmt = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <ModalPortal>
    <div data-chat-open={proposalId} className="fixed inset-0 z-[65] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <div className="min-w-0">
          <p className="truncate font-semibold">{info?.other_name ?? "Conversa"}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="size-3" /> Contatos e links são ocultados automaticamente</p>
        </div>
        <div className="flex items-center gap-1">
          {info && <ReportButton reportedId={info.other_id} requestId={info.request_id} />}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!info ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : msgs.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xs text-center text-xs text-muted-foreground">
            <ShieldCheck className="mx-auto mb-2 size-8 text-primary/60" />
            Combine horário, local e detalhes por aqui. O pagamento é feito diretamente no encontro — a Privora não processa pagamentos.
          </div>
        ) : msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {fmt(m.created_at)}{mine && (m.read_at ? " · lida" : "")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
        {info && !info.can_write ? (
          <p className="rounded-xl bg-secondary/50 p-3 text-center text-xs text-muted-foreground">{info.reason}</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escreva uma mensagem…"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button size="icon" className="size-10 shrink-0" disabled={!text.trim() || sending} onClick={send}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

/** Contagem de não lidas por proposta, atualizada em tempo real. */
export function useUnreadChats(userId: string | undefined) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc("my_unread_chats");
    const map: Record<string, number> = {};
    ((data as { proposal_id: string; unread: number }[]) ?? []).forEach((r) => { map[r.proposal_id] = r.unread; });
    setCounts(map);
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    refresh();
    const ch = supabase.channel(`unread-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refresh]);
  return { counts, refresh };
}
