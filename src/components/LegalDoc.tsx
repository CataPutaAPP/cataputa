import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface LegalDocData { slug: string; version: number; title: string; body: string; published_at: string }

/** Renderiza o texto legal: "## título", listas com "-" e parágrafos. */
export function LegalBody({ body }: { body: string }) {
  const blocos = body.trim().split("\n");
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {blocos.map((linha, i) => {
        const t = linha.trim();
        if (!t) return null;
        if (t.startsWith("## ")) return <h3 key={i} className="pt-3 text-base font-semibold text-foreground">{t.slice(3)}</h3>;
        if (t.startsWith("- ")) return <p key={i} className="pl-4">• {t.slice(2)}</p>;
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}

export function useLegalDoc(slug: "termos" | "privacidade") {
  const [doc, setDoc] = useState<LegalDocData | null>(null);
  useEffect(() => {
    supabase.rpc("legal_document", { p_slug: slug }).then(({ data }) => setDoc(data as LegalDocData));
  }, [slug]);
  return doc;
}

export function LegalPage({ slug }: { slug: "termos" | "privacidade" }) {
  const doc = useLegalDoc(slug);
  return (
    <main className="min-h-screen px-4 pb-16 pt-10" style={{ background: "#1E0E1A" }}>
      <div className="mx-auto max-w-2xl">
        <img src="/privora-selo.png" alt="Privora" className="mx-auto mb-6 size-16 object-contain" />
        {!doc ? (
          <div className="flex justify-center py-16"><Loader2 className="size-7 animate-spin text-primary" /></div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold">{doc.title}</h1>
            <p className="mb-6 mt-1 text-xs text-muted-foreground">
              Versão {doc.version} · em vigor desde {new Date(doc.published_at).toLocaleDateString("pt-BR")}
            </p>
            <LegalBody body={doc.body} />
          </>
        )}
        <p className="mt-10 text-center text-xs text-muted-foreground">Privora Private Club</p>
      </div>
    </main>
  );
}
