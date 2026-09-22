import { useEffect, useState } from "react";
import { X, Loader2, QrCode, CreditCard, Copy, Check, CheckCircle2, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/fees";

export interface CheckoutItem { type: "plano" | "impulso"; code: string; name: string; price: number }

interface Checkout {
  order_id: string; test_mode: boolean; amount: number; item_name: string; method: "pix" | "cartao";
  expires_at: string; pix_copy_paste: string | null; pix_qr_base64: string | null; checkout_url: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fnError(error: any, fallback: string): Promise<string> {
  try { const b = await error?.context?.json?.(); if (b?.error) return b.error; } catch { /* ignore */ }
  return error?.message || fallback;
}

/**
 * Pagamento de ASSINATURA ou IMPULSO (única cobrança do app).
 * Pix ou cartão; quem estornou cartão fica só com Pix. A ativação chega pelo banco (tempo real).
 */
export function CheckoutSheet({ item, cardBlocked, isAdmin, onClose, onPaid }: {
  item: CheckoutItem; cardBlocked: boolean; isAdmin: boolean; onClose: () => void; onPaid: () => void;
}) {
  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [co, setCo] = useState<Checkout | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  // Confirmação em tempo real (webhook do gateway → apply_payment → status "pago")
  useEffect(() => {
    if (!co) return;
    const ch = supabase.channel(`order-${co.order_id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payment_orders", filter: `id=eq.${co.order_id}` },
        (p) => { if ((p.new as { status: string }).status === "pago") setPaid(true); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [co]);

  useEffect(() => { if (paid) { toast.success("Pagamento confirmado!"); onPaid(); } }, [paid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setBusy(true);
    const { data: order, error } = await supabase.rpc("create_order", {
      p_item_type: item.type, p_code: item.code, p_method: method, p_coupon: coupon.trim() || null,
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    const { data, error: fe } = await supabase.functions.invoke("billing-checkout", { body: { order_id: (order as { order_id: string }).order_id } });
    setBusy(false);
    if (fe) return toast.error(await fnError(fe, "Não foi possível gerar o pagamento."));
    setCo(data as Checkout);
    if ((data as Checkout).method === "cartao" && (data as Checkout).checkout_url) window.open((data as Checkout).checkout_url!, "_blank");
  }

  async function simulate() {
    if (!co) return;
    setBusy(true);
    const { error } = await supabase.rpc("apply_payment", { p_order_id: co.order_id, p_provider_ref: null });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function copyPix() {
    if (!co?.pix_copy_paste) return;
    await navigator.clipboard.writeText(co.pix_copy_paste);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{paid ? "Tudo certo!" : "Pagamento"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
        </div>

        {paid ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 size-14 text-green-400" />
            <p className="font-semibold">{item.name} ativado</p>
            <Button className="mt-5 w-full" onClick={onClose}>Fechar</Button>
          </div>
        ) : !co ? (
          <>
            <div className="mb-4 rounded-2xl border border-border p-4">
              <p className="text-sm text-muted-foreground">{item.type === "plano" ? "Assinatura — 30 dias" : "Impulso"}</p>
              <p className="font-semibold">{item.name}</p>
              <p className="mt-1 text-2xl font-bold text-primary">{brl(item.price)}</p>
            </div>

            <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button onClick={() => setMethod("pix")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${method === "pix" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                <QrCode className="size-4" /> Pix
              </button>
              <button onClick={() => !cardBlocked && setMethod("cartao")} disabled={cardBlocked}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${method === "cartao" ? "border-primary bg-primary/10 text-primary" : "border-border"} ${cardBlocked ? "opacity-40" : ""}`}>
                <CreditCard className="size-4" /> Cartão
              </button>
            </div>
            {cardBlocked && <p className="mb-2 text-[11px] text-muted-foreground">Cartão indisponível para sua conta. Use Pix.</p>}

            {item.type === "plano" && (
              <div className="mt-3">
                <p className="mb-1.5 text-sm font-semibold">Cupom (opcional)</p>
                <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="uppercase" />
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Pré-pago, sem renovação automática. Na fatura aparece um nome discreto, sem referência ao app.
            </p>
            <Button className="mt-4 h-12 w-full text-base" disabled={busy} onClick={generate}>
              {busy ? <Loader2 className="mr-2 size-5 animate-spin" /> : null} Gerar pagamento
            </Button>
          </>
        ) : (
          <>
            {co.test_mode && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs text-yellow-300">
                <FlaskConical className="mt-0.5 size-4 shrink-0" />
                <span>Modo teste: nenhum valor é cobrado. {isAdmin ? "Use o botão abaixo para simular a aprovação." : "Aguardando configuração do pagamento."}</span>
              </div>
            )}
            <div className="mb-4 text-center">
              <p className="text-sm text-muted-foreground">{co.item_name}</p>
              <p className="text-3xl font-bold text-primary">{brl(co.amount)}</p>
            </div>

            {co.method === "pix" ? (
              <>
                {co.pix_qr_base64 && (
                  <img src={`data:image/png;base64,${co.pix_qr_base64}`} alt="QR Code Pix" className="mx-auto mb-3 size-52 rounded-xl bg-white p-2" />
                )}
                {co.pix_copy_paste && (
                  <div className="rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="mb-1 text-[11px] text-muted-foreground">Pix copia e cola</p>
                    <p className="break-all font-mono text-xs">{co.pix_copy_paste}</p>
                    <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={copyPix}>
                      {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />} {copied ? "Copiado!" : "Copiar código"}
                    </Button>
                  </div>
                )}
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Válido até {new Date(co.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. A liberação é automática após o pagamento.
                </p>
              </>
            ) : (
              <div className="text-center">
                {co.checkout_url
                  ? <Button className="w-full" onClick={() => window.open(co.checkout_url!, "_blank")}><CreditCard className="mr-2 size-4" /> Abrir pagamento seguro</Button>
                  : <p className="text-xs text-muted-foreground">O pagamento com cartão abre numa página segura do gateway.</p>}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Aguardando confirmação…
            </div>
            {co.test_mode && isAdmin && (
              <Button variant="secondary" className="mt-4 w-full" disabled={busy} onClick={simulate}>
                <FlaskConical className="mr-2 size-4" /> Simular pagamento aprovado
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
