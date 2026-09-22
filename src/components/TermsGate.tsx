import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, ScrollText, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ModalPortal";
import { LegalBody, type LegalDocData } from "@/components/LegalDoc";
import { supabase } from "@/lib/supabase";

interface Pendente { slug: "termos" | "privacidade"; version: number; title: string }

/**
 * Exige o aceite dos documentos vigentes antes de usar o app.
 * Publicar uma versão nova faz todos aceitarem de novo — é o registro
 * que comprova a concordância (LGPD e ECA Digital).
 */
export function TermsGate({ children }: { children: ReactNode }) {
  const [pendentes, setPendentes] = useState<Pendente[] | null>(null);
  const [docs, setDocs] = useState<LegalDocData[]>([]);
  const [aceitando, setAceitando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_pending_terms");
    if (error) { setPendentes([]); return; }   // M16 ainda não aplicada: não trava o app
    const lista = (data as Pendente[]) ?? [];
    setPendentes(lista);
    if (lista.length) {
      const textos = await Promise.all(
        lista.map((p) => supabase.rpc("legal_document", { p_slug: p.slug })),
      );
      setDocs(textos.map((t) => t.data as LegalDocData).filter(Boolean));
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function aceitar() {
    setAceitando(true);
    const { error } = await supabase.rpc("accept_terms");
    setAceitando(false);
    if (error) return toast.error(error.message);
    toast.success("Obrigado! Bom uso.");
    carregar();
  }

  if (pendentes === null) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  }
  if (pendentes.length === 0) return <>{children}</>;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[150] flex flex-col bg-background">
        <div className="border-b border-border px-5 py-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <p className="flex items-center gap-2 font-semibold"><ScrollText className="size-4 text-primary" /> Antes de continuar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {docs.length > 1 ? "Estes documentos foram atualizados." : "Este documento foi atualizado."} Leia e confirme para seguir usando a Privora.
          </p>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5">
          {docs.map((d) => (
            <section key={d.slug}>
              <h2 className="font-display text-xl font-semibold">{d.title}</h2>
              <p className="mb-3 text-[11px] text-muted-foreground">Versão {d.version}</p>
              <LegalBody body={d.body} />
            </section>
          ))}
        </div>

        <div className="border-t border-border p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
          <p className="mb-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            Ao continuar, você declara ter <b>18 anos ou mais</b> e concordar com os documentos acima.
          </p>
          <Button className="h-12 w-full text-base" disabled={aceitando} onClick={aceitar}>
            {aceitando ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Check className="mr-2 size-5" />}
            Li e concordo
          </Button>
        </div>
      </div>
    </ModalPortal>
  );
}
