import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Clock, Loader2, MapPin, MessageCircle, Navigation, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBackClose } from "@/lib/back";
import { SecureImg } from "@/lib/media";
import { partnerIcon, partnerLabel } from "@/lib/partner-types";
import { supabase } from "@/lib/supabase";
import { quandoBR } from "@/components/PartnerAgenda";

/**
 * Página do local parceiro, aberta pelo ponto do mapa.
 *  - Clínica: equipe disponível com foto → cliente escolhe e pede um horário →
 *    a clínica confirma → só então o WhatsApp do local aparece.
 *  - Casa de swing e demais vitrines: informações e rota.
 */
interface Info {
  id: string; name: string | null; local_type: string | null; address: string | null; description: string | null;
  lat: number | null; lng: number | null; open_now: boolean; has_whatsapp: boolean; rooms: number; booking?: boolean;
  staff: { id: string; name: string; bio: string | null; photo_url: string }[];
}
interface Meu { id: string; staff_id: string | null; starts_at: string; status: string; discount_pct: number | null }

const pad = (n: number) => String(n).padStart(2, "0");
/** Data e hora sugeridas: próxima hora cheia + 1h, no relógio de Brasília. */
function sugestao() {
  const br = new Date(new Date(Date.now() + 2 * 3600000).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return { dia: `${br.getFullYear()}-${pad(br.getMonth() + 1)}-${pad(br.getDate())}`, hora: `${pad(br.getHours())}:00` };
}
const zap = (n: string) => `https://wa.me/${n.length <= 11 ? "55" + n : n}`;

export function PartnerSheet({ partnerId, userId, onClose }: { partnerId: string; userId: string; onClose: () => void }) {
  useBackClose(true, onClose);
  const [info, setInfo] = useState<Info | null | "erro">(null);
  const [meus, setMeus] = useState<Meu[]>([]);
  const [contatos, setContatos] = useState<Record<string, string>>({});
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [{ dia, hora }, setQuando] = useState(sugestao);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarMeus = useCallback(async () => {
    const { data } = await supabase.from("partner_appointments")
      .select("id, staff_id, starts_at, status, discount_pct")
      .eq("partner_id", partnerId).eq("client_id", userId)
      .in("status", ["solicitado", "confirmado"]).order("starts_at");
    const lista = (data as Meu[]) ?? [];
    setMeus(lista);
    // WhatsApp só existe para agendamento confirmado: o banco devolve vazio nos demais
    const novos: Record<string, string> = {};
    await Promise.all(lista.filter((a) => a.status === "confirmado").map(async (a) => {
      const r = await supabase.rpc("appointment_contact", { p_id: a.id });
      if (!r.error && typeof r.data === "string" && r.data) novos[a.id] = r.data;
    }));
    setContatos(novos);
  }, [partnerId, userId]);

  useEffect(() => {
    supabase.rpc("partner_public_info", { p_partner_id: partnerId })
      .then(({ data, error }) => setInfo(error || !data ? "erro" : (data as Info)));
    carregarMeus();
    const t = setInterval(carregarMeus, 20000);
    return () => clearInterval(t);
  }, [partnerId, carregarMeus]);

  async function pedir() {
    if (!escolhida) return;
    if (!dia || !hora) return toast.error("Escolha o dia e o horário.");
    setEnviando(true);
    const { error } = await supabase.rpc("request_appointment", {
      p_partner_id: partnerId, p_staff_id: escolhida, p_starts_at: `${dia}T${hora}:00-03:00`, p_note: nota.trim() || null,
    });
    setEnviando(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado. Você é avisado quando o local confirmar.");
    setEscolhida(null); setNota(""); carregarMeus();
  }
  async function desistir(a: Meu) {
    if (!confirm("Cancelar este agendamento?")) return;
    const { error } = await supabase.rpc("cancel_appointment", { p_id: a.id });
    if (error) return toast.error(error.message);
    carregarMeus();
  }

  const dados = info && info !== "erro" ? info : null;
  // equipe e agenda só quando a chave de clínicas está ligada (o banco informa em "booking")
  const clinica = dados?.local_type === "clinica" && dados.booking !== false;
  const nomeDe = (id: string | null) => dados?.staff.find((s) => s.id === id)?.name ?? "Equipe";
  const pessoa = dados?.staff.find((s) => s.id === escolhida);

  return (
    <div className="fixed app-sheet z-40 flex flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl lg:rounded-none lg:border-r lg:border-t-0">
      <header className="flex items-start gap-3 border-b border-border p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-xl font-bold text-white">
          {partnerIcon(dados?.local_type)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{dados?.name ?? "Local parceiro"}</h2>
          <p className="text-xs text-muted-foreground">
            {partnerLabel(dados?.local_type)}
            {dados && <span className={dados.open_now ? "text-green-400" : ""}> · {dados.open_now ? "Aberto agora" : "Fechado agora"}</span>}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="size-5" /></Button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-[calc(1.5rem+var(--safe-b))]">
        {info === null && <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>}
        {info === "erro" && <p className="py-12 text-center text-sm text-muted-foreground">Este local não está disponível no momento.</p>}

        {dados && (
          <>
            {/* Meus agendamentos aqui */}
            {meus.map((a) => (
              <div key={a.id} className={`rounded-2xl border p-4 ${a.status === "confirmado" ? "border-green-500/40 bg-green-500/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
                <div className="flex items-start gap-3">
                  {a.status === "confirmado" ? <Check className="mt-0.5 size-5 shrink-0 text-green-400" /> : <Clock className="mt-0.5 size-5 shrink-0 text-yellow-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.status === "confirmado" ? "Agendamento confirmado" : "Aguardando o local confirmar"}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {quandoBR(a.starts_at)} · {nomeDe(a.staff_id)}{a.discount_pct ? ` · −${Number(a.discount_pct)}%` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {a.status === "confirmado" && contatos[a.id] && (
                    <a href={zap(contatos[a.id] as string)} target="_blank" rel="noopener noreferrer"
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-black">
                      <MessageCircle className="size-4" /> WhatsApp do local
                    </a>
                  )}
                  <Button variant="ghost" className="h-10 text-xs text-muted-foreground" onClick={() => desistir(a)}>Cancelar</Button>
                </div>
                {a.status === "solicitado" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">O WhatsApp do local aparece aqui assim que o horário for confirmado.</p>
                )}
              </div>
            ))}

            {/* Endereço e rota */}
            <div className="space-y-2">
              {dados.address && (
                <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{dados.address}</p>
              )}
              {dados.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{dados.description}</p>}
              {dados.lat != null && dados.lng != null && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${dados.lat},${dados.lng}`} target="_blank" rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium">
                  <Navigation className="size-4" /> Traçar rota
                </a>
              )}
            </div>

            {/* Clínica: equipe */}
            {clinica && (
              <section className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">Quem está atendendo</h3>
                  <span className="text-xs text-muted-foreground">{dados.staff.length} disponível(is)</span>
                </div>
                {dados.staff.length === 0 && (
                  <p className="rounded-xl bg-secondary/40 p-4 text-center text-sm text-muted-foreground">Ninguém disponível agora. Volte mais tarde.</p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {dados.staff.map((s) => {
                    const on = escolhida === s.id;
                    return (
                      <button key={s.id} onClick={() => setEscolhida(on ? null : s.id)} aria-pressed={on}
                        className={`overflow-hidden rounded-2xl border text-left transition-all ${on ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
                        <div className="relative">
                          <SecureImg src={s.photo_url} alt={s.name} className="aspect-[3/4] w-full object-cover" />
                          {on && <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-4" /></span>}
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-sm font-semibold">{s.name}</p>
                          {s.bio && <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{s.bio}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {pessoa && (
                  <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4 text-primary" />Horário com {pessoa.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={dia} min={sugestao().dia} aria-label="Dia"
                        onChange={(e) => setQuando({ dia: e.target.value, hora })}
                        className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                      <input type="time" value={hora} step={900} aria-label="Horário"
                        onChange={(e) => setQuando({ dia, hora: e.target.value })}
                        className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
                    </div>
                    <Textarea rows={2} maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)}
                      placeholder="Algum recado para o local? (opcional)" />
                    <Button className="h-12 w-full" disabled={enviando} onClick={pedir}>
                      {enviando && <Loader2 className="mr-2 size-4 animate-spin" />} Pedir este horário
                    </Button>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Horário de Brasília. O local confirma ou sugere outro horário. O valor é acertado e pago direto no estabelecimento.
                    </p>
                  </div>
                )}
              </section>
            )}

            {!clinica && dados.rooms > 0 && (
              <p className="rounded-xl bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
                Este local tem {dados.rooms} quarto(s) no app. Você escolhe o quarto ao confirmar um atendimento com local "Parceiro". O quarto é pago direto no estabelecimento.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
