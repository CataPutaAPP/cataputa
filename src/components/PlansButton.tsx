import { useEffect, useState } from "react";
import { Crown, X, Loader2, Check, Minus, Ticket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/fees";
import { useMyPlan } from "@/lib/plans";
import { CheckoutSheet, type CheckoutItem } from "@/components/CheckoutSheet";
import type { UserRole } from "@/types";
import { ModalPortal } from "@/components/ModalPortal";

interface Plan { id: string; code: string; name: string; description: string | null; price_month: number; sort_order: number }
interface Feature { feature: string; label: string; kind: "limite" | "recurso"; sort_order?: number }
interface PlanFeature { plan_id: string; feature: string; value: number }

function fmtValue(kind: Feature["kind"], v: number | undefined) {
  if (v === undefined) return <Minus className="size-4 text-muted-foreground/50" />;
  if (kind === "recurso") return Number(v) === 1 ? <Check className="size-4 text-green-400" /> : <Minus className="size-4 text-muted-foreground/50" />;
  return <span className="font-medium">{Number(v) < 0 ? "Ilimitado" : v}</span>;
}

/** Vitrine de planos do público do usuário + resgate de código de campanha. */
export function PlansButton({ audience }: { audience: UserRole }) {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [values, setValues] = useState<PlanFeature[]>([]);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutItem | null>(null);
  const { plan: my, refresh } = useMyPlan(open);

  useEffect(() => {
    if (!open || plans) return;
    (async () => {
      const [{ data: p }, { data: f }] = await Promise.all([
        supabase.from("plans").select("id, code, name, description, price_month, sort_order")
          .eq("audience", audience).eq("is_active", true).order("sort_order"),
        supabase.from("feature_catalog").select("feature, label, kind, sort_order").eq("audience", audience).order("sort_order").order("label"),
      ]);
      const list = (p as Plan[]) ?? [];
      setPlans(list); setFeatures((f as Feature[]) ?? []);
      if (list.length) {
        const { data: v } = await supabase.from("plan_features").select("plan_id, feature, value").in("plan_id", list.map((x) => x.id));
        setValues((v as PlanFeature[]) ?? []);
      }
    })();
  }, [open, plans, audience]);

  async function redeem() {
    if (!code.trim()) return;
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_campaign", { p_code: code.trim() });
    setRedeeming(false);
    if (error) return toast.error(error.message || "Código inválido.");
    const d = data as { type: string; message?: string };
    toast.success(d.type === "cupom_desconto" ? (d.message ?? "Cupom guardado para o pagamento") : "Código aplicado!");
    setCode(""); refresh();
  }

  const val = (planId: string, feature: string) => values.find((v) => v.plan_id === planId && v.feature === feature)?.value;

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Planos" onClick={() => setOpen(true)}>
        <Crown className="size-5 text-yellow-500" />
      </Button>
      {open && (
        <ModalPortal>
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Planos</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-5" /></Button>
            </div>

            {my?.is_beta && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <span><b className="text-primary">Beta de lançamento:</b> todos os recursos estão liberados gratuitamente por tempo limitado.</span>
              </div>
            )}
            {my && !my.is_beta && (
              <p className="mb-4 text-xs text-muted-foreground">
                Seu plano: <b className="text-foreground">{my.plan_name}</b>
                {my.expires_at && ` · válido até ${new Date(my.expires_at).toLocaleDateString("pt-BR")}`}
                {my.expires_at && (new Date(my.expires_at).getTime() - Date.now()) < 3 * 864e5 && (
                  <span className="ml-1 font-semibold text-yellow-400">· vence em breve, renove para não perder os recursos</span>
                )}
              </p>
            )}

            {!plans ? (
              <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3">
                {plans.map((p) => {
                  const current = !my?.is_beta && my?.plan_code === p.code;
                  return (
                    <article key={p.id} className={`rounded-2xl border p-4 ${current ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{p.name} {current && <Badge className="ml-1 text-[10px]">Atual</Badge>}</p>
                          {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                        </div>
                        <p className="shrink-0 text-right">
                          <span className="text-lg font-bold text-primary">{Number(p.price_month) === 0 ? "Grátis" : brl(p.price_month)}</span>
                          {Number(p.price_month) > 0 && <span className="block text-[10px] text-muted-foreground">por mês</span>}
                        </p>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-xs">
                        {features.map((f) => (
                          <li key={f.feature} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{f.label}</span>{fmtValue(f.kind, val(p.id, f.feature))}
                          </li>
                        ))}
                      </ul>
                      {Number(p.price_month) > 0 && (
                        <Button className="mt-3 h-9 w-full" disabled={!my?.can_buy}
                          onClick={() => setCheckout({ type: "plano", code: p.code, name: `Plano ${p.name}`, price: Number(p.price_month) })}>
                          {!my?.can_buy ? "Assinatura disponível em breve" : current && my?.source === "gateway" ? "Renovar +30 dias" : `Assinar ${p.name}`}
                        </Button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Ticket className="size-4" /> Tem um código?</p>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="uppercase" />
                <Button disabled={redeeming || !code.trim()} onClick={redeem}>
                  {redeeming ? <Loader2 className="size-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      {checkout && (
        <CheckoutSheet item={checkout} cardBlocked={!!my?.card_blocked} isAdmin={!!my?.is_admin}
          onClose={() => setCheckout(null)} onPaid={() => refresh()} />
      )}
    </>
  );
}
