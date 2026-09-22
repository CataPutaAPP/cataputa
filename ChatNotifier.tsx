import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { playNotificationSound } from "@/lib/notifications";

/** Aviso global de nova mensagem (som + toast), em qualquer tela do painel. */
export function ChatNotifier({ userId }: { userId: string }) {
  useEffect(() => {
    const ch = supabase.channel(`chat-notify-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          // se a conversa já está aberta, o próprio chat mostra a mensagem
          if (document.querySelector(`[data-chat-open="${(payload.new as { proposal_id: string }).proposal_id}"]`)) return;
          playNotificationSound("message");
          toast("Nova mensagem no chat", { icon: "💬" });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);
  return null;
}
