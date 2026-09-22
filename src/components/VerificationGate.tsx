import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, Loader2, ShieldAlert, Building2, ScanFace, IdCard, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

interface MyVerification {
  required: boolean;
  audience: "cliente" | "prestador" | "parceiro";
  status: "pendente" | "em_analise" | "documento_necessario" | "aprovado" | "reprovado";
  reject_reason: string | null;
  needs_cnpj: boolean;
  cnpj: string | null;
  cnpj_ok: boolean;
  suspended: boolean;
  suspended_reason: string | null;
  cleared: boolean;
}

// Mensagem de erro vinda da Edge Function ({ error: "..." })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fnError(error: any, fallback: string): Promise<string> {
  try { const b = await error?.context?.json?.(); if (b?.error) return b.error; } catch { /* ignore */ }
  return error?.message || fallback;
}

const maskCnpj = (v: string) => v.replace(/\D/g, "").slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");

// Fora do componente: declarado dentro, o React recriaria o input a cada tecla (perde o foco)
function Card({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 pt-20 pb-10" style={{ background: "#0a0a12" }}>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center">{children}</div>
    </main>
  );
}

/**
 * Bloqueia o painel até o usuário estar liberado (ECA Digital).
 * Com verification_required = 0 no banco, só barra contas suspensas.
 */
export function VerificationGate({ children }: { children: ReactNode }) {
  const [v, setV] = useState<MyVerification | null>(null);
  const [starting, setStarting] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [checkingCnpj, setCheckingCnpj] = useState(false);
  const returning = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("verificacao") === "retorno";
  const [waiting, setWaiting] = useState(returning);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_verification");
    if (error) { console.error("my_verification", error); setV({ cleared: true } as MyVerification); return; } // não trava o app se a M2 não estiver aplicada
    setV(data as MyVerification);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Ao voltar da Didit: acompanha até o webhook gravar o resultado (realtime + consulta de segurança)
  useEffect(() => {
    if (!v || v.cleared || (!waiting && v.status !== "em_analise")) return;
    const ch = supabase.channel("my-verification")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_verification" }, () => load())
      .subscribe();
    const poll = setInterval(load, 5000);
    const stop = setTimeout(() => setWaiting(false), 90000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); clearTimeout(stop); };
  }, [v, waiting, load]);

  useEffect(() => {
    if (!v) return;
    if (v.status !== "pendente" && v.status !== "em_analise") setWaiting(false);
    if (v.cleared && returning) {
      toast.success("Verificação concluída! Bem-vindo à Privora.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [v, returning]);

  async function start(kind?: "documento") {
    setStarting(true);
    const { data, error } = await supabase.functions.invoke("verification-start", { body: kind ? { kind } : {} });
    if (error) { setStarting(false); return toast.error(await fnError(error, "Não foi possível iniciar a verificação.")); }
    if (data?.already) { setStarting(false); return load(); }
    window.location.href = data.url;
  }

  async function checkCnpj() {
    setCheckingCnpj(true);
    const { data, error } = await supabase.functions.invoke("verify-cnpj", { body: { cnpj } });
    setCheckingCnpj(false);
    if (error) return toast.error(await fnError(error, "Não foi possível validar o CNPJ."));
    toast.success(`CNPJ confirmado: ${data.legal_name ?? "empresa ativa"}`);
    load();
  }

  if (!v) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (v.cleared) return <>{children}</>;

  if (v.suspended) return (
    <Card>
      <ShieldAlert className="mx-auto mb-3 size-12 text-destructive" />
      <h1 className="text-xl font-semibold">Conta suspensa</h1>
      <p className="mt-2 text-sm text-muted-foreground">{v.suspended_reason ?? "Sua conta está suspensa."}</p>
      <p className="mt-4 text-xs text-muted-foreground">Se acredita que é um engano, fale com o suporte.</p>
    </Card>
  );

  const needsIdentity = v.status !== "aprovado";
  const needsCnpj = v.needs_cnpj && !v.cnpj_ok;
  const isClient = v.audience === "cliente";

  if (waiting || v.status === "em_analise") return (
    <Card>
      {v.status === "em_analise" ? <Clock className="mx-auto mb-3 size-12 text-yellow-400" /> : <Loader2 className="mx-auto mb-3 size-12 animate-spin text-primary" />}
      <h1 className="text-xl font-semibold">{v.status === "em_analise" ? "Verificação em análise" : "Conferindo sua verificação…"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {v.status === "em_analise" ? "Estamos revisando seus dados. Você será liberado automaticamente assim que aprovar." : "Isso leva alguns segundos. Não feche esta tela."}
      </p>
    </Card>
  );

  return (
    <Card>
      <ShieldCheck className="mx-auto mb-3 size-12 text-primary" />
      <h1 className="text-xl font-semibold">Verificação obrigatória</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isClient
          ? "Por lei (ECA Digital), a Privora é exclusiva para maiores de 18 anos. Confirme sua idade com uma selfie rápida."
          : "Para a segurança de todos, confirmamos identidade e idade com documento e selfie antes de você aparecer no app."}
      </p>

      {v.status === "reprovado" && v.reject_reason && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{v.reject_reason}</p>
      )}
      {v.status === "documento_necessario" && (
        <p className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-300">
          {v.reject_reason ?? "Precisamos confirmar sua idade com um documento."}
        </p>
      )}

      {needsCnpj && (
        <div className="mt-5 space-y-2 rounded-2xl border border-border p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4" /> 1. CNPJ do estabelecimento</p>
          <Input value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" />
          <Button className="w-full" variant="secondary" disabled={checkingCnpj || cnpj.replace(/\D/g, "").length !== 14} onClick={checkCnpj}>
            {checkingCnpj ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Validar na Receita Federal
          </Button>
        </div>
      )}
      {v.needs_cnpj && v.cnpj_ok && (
        <p className="mt-5 text-xs text-green-400">✓ CNPJ confirmado</p>
      )}

      {needsIdentity && (
        <div className="mt-5 space-y-2">
          {v.needs_cnpj && <p className="text-left text-sm font-semibold">2. Identidade do responsável</p>}
          {isClient && v.status !== "documento_necessario" ? (
            <>
              <Button className="h-12 w-full text-base" disabled={starting} onClick={() => start()}>
                {starting ? <Loader2 className="mr-2 size-5 animate-spin" /> : <ScanFace className="mr-2 size-5" />} Verificar com selfie
              </Button>
              <button className="text-xs text-muted-foreground underline" disabled={starting} onClick={() => start("documento")}>
                Prefiro usar documento
              </button>
            </>
          ) : (
            <Button className="h-12 w-full text-base" disabled={starting} onClick={() => start("documento")}>
              {starting ? <Loader2 className="mr-2 size-5 animate-spin" /> : <IdCard className="mr-2 size-5" />} Verificar com documento e selfie
            </Button>
          )}
        </div>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        A verificação é feita pela Didit, empresa especializada. A Privora não recebe nem guarda sua selfie ou documento — apenas o resultado.
      </p>
    </Card>
  );
}
