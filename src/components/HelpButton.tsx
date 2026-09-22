import { useEffect, useState } from "react";
import { HelpCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types";

interface HelpItem { id: string; title: string; body: string; sort_order: number }

/** Botão "?" do cabeçalho. Textos vêm de help_content (editável no Admin, sem deploy). */
export function HelpButton({ screen }: { screen: UserRole }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HelpItem[] | null>(null);

  useEffect(() => {
    if (!open || items) return;
    supabase
      .from("help_content")
      .select("id, title, body, sort_order")
      .eq("screen", screen)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setItems((data as HelpItem[]) ?? []));
  }, [open, items, screen]);

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Como funciona" onClick={() => setOpen(true)}>
        <HelpCircle className="size-5" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Como funciona</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-5" /></Button>
            </div>
            {!items ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma regra cadastrada ainda.</p>
            ) : (
              <div className="space-y-4">
                {items.map((it) => (
                  <section key={it.id}>
                    <h3 className="text-sm font-semibold text-primary">{it.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
