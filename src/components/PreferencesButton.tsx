import { useEffect, useState } from "react";
import { Settings, X, EyeOff, Smartphone, Lock, Check, Download, Trash2, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ModalPortal";
import { useMyPlan } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { useDiscreet } from "@/lib/discreet";
import { usePush } from "@/lib/push";
import { useAuth } from "@/context/AuthContext";

// evento do navegador que permite oferecer a instalação na tela inicial
interface PromptInstalacao extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function PreferencesButton() {
  const [open, setOpen] = useState(false);
  const { plan } = useMyPlan();
  const liberado = Number(plan?.features?.["discreet_mode"] ?? 0) === 1;
  const { ligado, alternar } = useDiscreet(liberado);
  const [instalar, setInstalar] = useState<PromptInstalacao | null>(null);
  const [instalado, setInstalado] = useState(false);
  const { signOut } = useAuth();
  const push = usePush();
  const [excluindo, setExcluindo] = useState(false);

  async function excluirConta() {
    const confirmacao = window.prompt(
      "Isto apaga sua conta, fotos, anúncios, conversas e histórico. Não dá para desfazer.\n\nPara confirmar, escreva EXCLUIR:",
    );
    if (confirmacao?.trim().toUpperCase() !== "EXCLUIR") return;
    const motivo = window.prompt("Se quiser, conte por que está saindo (opcional):") || null;
    setExcluindo(true);
    const { error } = await supabase.rpc("delete_my_account", { p_reason: motivo });
    setExcluindo(false);
    if (error) return toast.error(error.message);
    toast.success("Conta excluída. Até logo.");
    signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    const aoPoderInstalar = (e: Event) => { e.preventDefault(); setInstalar(e as PromptInstalacao); };
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    setInstalado(window.matchMedia("(display-mode: standalone)").matches);
    // necessário para o navegador oferecer a instalação na tela inicial
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* sem instalação, app segue normal */ });
    }
    return () => window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
  }, []);

  async function instalarApp() {
    if (!instalar) return toast("No iPhone: toque em Compartilhar → Adicionar à Tela de Início.", { icon: "📱" });
    await instalar.prompt();
    const r = await instalar.userChoice;
    if (r.outcome === "accepted") { setInstalado(true); setInstalar(null); }
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Preferências" onClick={() => setOpen(true)}>
        <Settings className="size-5" />
      </Button>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
            <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Preferências</h2>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-5" /></Button>
              </div>

              {/* Modo discreto */}
              <section className="rounded-2xl border border-border p-4">
                <p className="flex items-center gap-2 font-semibold"><EyeOff className="size-4" /> Modo discreto</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  O app passa a se chamar <b>Agenda</b>, com ícone neutro — na aba do navegador e também
                  na tela inicial do celular. A tela some sozinha quando você troca de aplicativo.
                </p>

                {liberado ? (
                  <button onClick={() => { alternar(!ligado); toast.success(ligado ? "Modo discreto desligado." : "Modo discreto ligado."); }}
                    className={`mt-3 flex w-full items-center justify-between rounded-xl border p-3 text-sm ${ligado ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                    <span>{ligado ? "Ligado" : "Desligado"}</span>
                    {ligado ? <Check className="size-4" /> : null}
                  </button>
                ) : (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                    <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>Faz parte do <b className="text-primary">Privora Pass</b>. Veja no ícone da coroa.</span>
                  </div>
                )}

                {ligado && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Já instalou na tela inicial? Remova e instale de novo para o ícone neutro valer.
                  </p>
                )}
              </section>

              {/* Avisos */}
              <section className="mt-3 rounded-2xl border border-border p-4">
                <p className="flex items-center gap-2 font-semibold"><Bell className="size-4" /> Avisos no celular</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Receba chamados novos, propostas e respostas mesmo com o app fechado.
                  No modo discreto o aviso aparece como "Agenda".
                </p>
                {!push.suportado ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Seu navegador não aceita avisos. No iPhone, instale o app na tela inicial primeiro.
                  </p>
                ) : !push.configurado ? (
                  <p className="mt-3 text-xs text-muted-foreground">Em breve.</p>
                ) : (
                  <Button variant="secondary" className="mt-3 w-full" disabled={push.ocupado}
                    onClick={async () => {
                      if (push.inscrito) { await push.desativar(); toast.success("Avisos desligados neste aparelho."); return; }
                      const erro = await push.ativar();
                      if (erro) toast.error(erro); else toast.success("Pronto! Você receberá avisos neste aparelho.");
                    }}>
                    {push.ocupado ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Bell className="mr-2 size-4" />}
                    {push.inscrito ? "Desligar avisos neste aparelho" : "Ativar avisos"}
                  </Button>
                )}
              </section>

              {/* Instalar */}
              <section className="mt-3 rounded-2xl border border-border p-4">
                <p className="flex items-center gap-2 font-semibold"><Smartphone className="size-4" /> Instalar no celular</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Abre em tela cheia, sem barra do navegador, e não aparece no histórico do site.
                </p>
                <Button variant="secondary" className="mt-3 w-full" disabled={instalado} onClick={instalarApp}>
                  <Download className="mr-2 size-4" /> {instalado ? "Já instalado" : "Instalar"}
                </Button>
              </section>

              {/* Excluir conta */}
              <section className="mt-3 rounded-2xl border border-destructive/30 p-4">
                <p className="flex items-center gap-2 font-semibold text-destructive"><Trash2 className="size-4" /> Excluir minha conta</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Apaga perfil, fotos, anúncios, conversas e histórico. Guardamos apenas o registro de que
                  a verificação de idade foi feita, por 5 anos, como exige a lei. Não dá para desfazer.
                </p>
                <Button variant="ghost" className="mt-3 w-full text-destructive hover:bg-destructive/10"
                  disabled={excluindo} onClick={excluirConta}>
                  {excluindo ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                  Excluir conta
                </Button>
              </section>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
