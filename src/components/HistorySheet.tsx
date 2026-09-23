import { useCallback, useEffect, useState } from "react";
import { X, Loader2, History, Star, CheckCircle2, XCircle, Inbox } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ModalPortal";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/fees";
import { getSubLabel, getLocalLabel, type ServiceType } from "@/lib/service-options";

interface Item {
  request_id: string; papel: "cliente" | "prestador"; status: string; quando: string;
  outro_id: string | null; outro_nome: string | null;
  service_type: ServiceType; sub_type: string; local_option: string;
  preco: number | null; cancel_reason: string | null;
  minha_nota: number | null; nota_recebida: number | null; posso_avaliar: boolean;
}
interface Resumo { concluidos: number; cancelados: number; total_pago: number; total_recebido: number }

export function HistorySheet({ onClose, onViewProfile }: { onClose: () => void; onViewProfile?: (id: string) => void }) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");

  const carregar = useCallback(async () => {
    const [h, r] = await Promise.all([
      supabase.rpc("my_history", { p_limit: 30 }),
      supabase.rpc("history_summary"),
    ]);
    setItens((h.data as Item[]) ?? []);
    setResumo(r.data as Resumo);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviarNota(id: string) {
    if (nota < 1) return toast.error("Escolha de 1 a 5 estrelas.");
    const { error } = await supabase.rpc("rate_past_service", {
      p_request_id: id, p_stars: nota, p_comment: comentario || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Avaliação enviada!");
    setAvaliando(null); setNota(0); setComentario("");
    carregar();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-x-0 bottom-0 top-[76px] z-40 flex flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><History className="size-5 text-primary" /> Histórico</h2>
            {resumo && (
              <p className="text-xs text-muted-foreground">
                {resumo.concluidos} concluído(s) · {resumo.cancelados} cancelado(s)
                {resumo.total_recebido > 0 && ` · recebeu ${brl(resumo.total_recebido)}`}
                {resumo.total_pago > 0 && ` · pagou ${brl(resumo.total_pago)}`}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8">
          {!itens ? (
            <div className="flex justify-center py-10"><Loader2 className="size-7 animate-spin text-primary" /></div>
          ) : itens.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Inbox className="size-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum atendimento ainda.</p>
            </div>
          ) : itens.map((i) => {
            const concluido = i.status === "concluida";
            return (
              <article key={i.request_id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {concluido ? <CheckCircle2 className="size-4 text-green-500" /> : <XCircle className="size-4 text-destructive" />}
                      {getSubLabel(i.service_type, i.sub_type)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {i.outro_nome
                        ? (onViewProfile && i.outro_id && i.papel === "cliente"
                          ? <button className="hover:text-primary" onClick={() => onViewProfile(i.outro_id!)}>{i.outro_nome}</button>
                          : i.outro_nome)
                        : "—"} · {getLocalLabel(i.local_option)} · {new Date(i.quando).toLocaleDateString("pt-BR")}
                    </p>
                    {!concluido && i.cancel_reason && (
                      <p className="mt-1 text-xs italic text-muted-foreground">{i.cancel_reason}</p>
                    )}
                  </div>
                  {i.preco != null && <p className="shrink-0 font-bold text-primary">{brl(i.preco)}</p>}
                </div>

                {concluido && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {i.minha_nota != null && <span>Você deu {Number(i.minha_nota).toFixed(0)}★</span>}
                    {i.nota_recebida != null && <span>Recebeu {Number(i.nota_recebida).toFixed(0)}★</span>}
                  </div>
                )}

                {i.posso_avaliar && (
                  avaliando === i.request_id ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setNota(n)}>
                            <Star className={`size-7 ${n <= nota ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
                          </button>
                        ))}
                      </div>
                      <textarea value={comentario} onChange={(e) => setComentario(e.target.value)}
                        placeholder="Comentário (opcional)" rows={2}
                        className="w-full rounded-xl border border-border bg-background p-2.5 text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => enviarNota(i.request_id)}>Enviar</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAvaliando(null); setNota(0); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" className="mt-3 w-full"
                      onClick={() => { setAvaliando(i.request_id); setNota(0); setComentario(""); }}>
                      <Star className="mr-2 size-4" /> Avaliar
                    </Button>
                  )
                )}
              </article>
            );
          })}
          {itens && itens.length > 0 && (
            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Avaliação disponível por até 30 dias após o atendimento.
            </p>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
