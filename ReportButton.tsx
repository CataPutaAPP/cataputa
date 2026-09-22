import { useState } from "react";
import { Flag, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

const reasons = [
  { value: "suspeita_menor", label: "Suspeita de menor de idade", hint: "O perfil é suspenso na hora até a análise." },
  { value: "perfil_falso", label: "Perfil falso / fotos de outra pessoa" },
  { value: "violencia_ameaca", label: "Violência ou ameaça" },
  { value: "golpe", label: "Golpe ou cobrança indevida" },
  { value: "outro", label: "Outro motivo" },
];

/** Denunciar usuário. Suspeita de menor suspende o perfil imediatamente (regra no banco). */
export function ReportButton({ reportedId, requestId, variant = "ghost", className = "" }: {
  reportedId: string; requestId?: string; variant?: "ghost" | "secondary"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!reason) return toast.error("Escolha um motivo.");
    setSending(true);
    const { error } = await supabase.rpc("report_user", {
      p_reported_id: reportedId, p_reason: reason, p_details: details || null, p_request_id: requestId ?? null,
    });
    setSending(false);
    if (error) return toast.error(error.message || "Não foi possível enviar.");
    toast.success("Denúncia enviada. Obrigado por ajudar a manter o CataPuta seguro.");
    setOpen(false); setReason(""); setDetails("");
  }

  return (
    <>
      <Button variant={variant} size="sm" className={`text-muted-foreground hover:text-destructive ${className}`} onClick={() => setOpen(true)}>
        <Flag className="mr-1.5 size-3.5" /> Denunciar
      </Button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Denunciar</h3>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-5" /></Button>
            </div>
            <div className="space-y-2">
              {reasons.map((r) => (
                <button key={r.value} onClick={() => setReason(r.value)}
                  className={`w-full rounded-xl border p-3 text-left text-sm ${reason === r.value ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}>
                  {r.label}
                  {r.hint && reason === r.value && <span className="mt-0.5 block text-[11px] opacity-80">{r.hint}</span>}
                </button>
              ))}
            </div>
            <Textarea className="mt-3" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Detalhes (opcional)" />
            <Button className="mt-3 h-11 w-full" variant="destructive" disabled={sending || !reason} onClick={send}>
              {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Flag className="mr-2 size-4" />} Enviar denúncia
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">Denúncias falsas podem levar à suspensão de quem denunciou.</p>
          </div>
        </div>
      )}
    </>
  );
}
