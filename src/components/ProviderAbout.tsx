import { useCallback, useEffect, useState } from "react";
import { UserRound, Loader2, Save, Ruler } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useServiceOptions } from "@/lib/options";
import { buscarTraits, etniaDisponivel, CAMPOS_TRAITS, type Traits } from "@/lib/traits";

const MAX_BIO = 600;
const chip = (ligado: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs ${ligado ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`;

/** Editor do anunciante: texto "Sobre mim" e características que viram filtro de busca. */
export function ProviderAboutEditor({ userId }: { userId: string }) {
  const opcoes = useServiceOptions();
  const [t, setT] = useState<Traits | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mudou, setMudou] = useState(false);

  const carregar = useCallback(async () => {
    const [r] = await buscarTraits([userId]);
    setT(r ?? { id: userId, bio: null, ethnicity: null, hair: null, body_type: null, age_range: null, height_cm: null, languages: null, smoker: null });
  }, [userId]);
  useEffect(() => { carregar(); }, [carregar]);

  const muda = (parte: Partial<Traits>) => { setT((a) => (a ? { ...a, ...parte } : a)); setMudou(true); };

  async function salvar() {
    if (!t) return;
    const altura = t.height_cm ? Math.round(Number(t.height_cm)) : null;
    if (altura !== null && (altura < 130 || altura > 220)) return toast.error("Informe a altura em centímetros (ex.: 165).");
    setSalvando(true);
    const dados: Record<string, unknown> = {
      bio: t.bio?.trim() || null, hair: t.hair, body_type: t.body_type, age_range: t.age_range,
      height_cm: altura, languages: t.languages?.length ? t.languages : null, smoker: t.smoker,
    };
    if (etniaDisponivel()) dados["ethnicity"] = t.ethnicity;
    const { error } = await supabase.from("profiles").update(dados).eq("id", userId);
    setSalvando(false);
    if (error) return toast.error(`Não foi possível salvar: ${error.message}`);
    toast.success("Perfil atualizado.");
    setMudou(false);
    carregar();   // traz o texto como ficou (contatos são ocultados automaticamente)
  }

  if (!t) return <div className="flex justify-center rounded-2xl border border-border bg-card p-6"><Loader2 className="size-5 animate-spin text-primary" /></div>;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 font-semibold"><UserRound className="size-4" /> Sobre mim</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Conte em poucas linhas quem você é e como é o seu atendimento. Aparece no seu perfil e ajuda quem procura a escolher.
      </p>

      <Textarea rows={4} maxLength={MAX_BIO} className="mt-3" value={t.bio ?? ""}
        onChange={(e) => muda({ bio: e.target.value })}
        placeholder="Ex.: Sou carinhosa e discreta, atendo com calma em apartamento próprio. Gosto de conversar antes..." />
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>Telefone, redes sociais e links são ocultados automaticamente.</span>
        <span>{(t.bio ?? "").length}/{MAX_BIO}</span>
      </div>

      <p className="mt-4 text-sm font-semibold">Características</p>
      <p className="text-[11px] text-muted-foreground">Tudo opcional. O que você marcar vira filtro na busca dos clientes.</p>

      <div className="mt-3 space-y-3">
        {CAMPOS_TRAITS.map(({ campo, titulo }) => {
          if (campo === "ethnicity" && !etniaDisponivel()) return null;
          const lista = opcoes.atributos(campo);
          if (lista.length === 0) return null;
          const varios = campo === "languages";
          const atual = varios ? (t.languages ?? []) : [t[campo]].filter(Boolean) as string[];
          return (
            <div key={campo}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">{titulo}{varios ? " (pode marcar vários)" : ""}</p>
              <div className="flex flex-wrap gap-1.5">
                {lista.map((o) => {
                  const ligado = atual.includes(o.value);
                  return (
                    <button key={o.value} type="button" className={chip(ligado)}
                      onClick={() => varios
                        ? muda({ languages: ligado ? atual.filter((x) => x !== o.value) : [...atual, o.value] })
                        : muda({ [campo]: ligado ? null : o.value } as Partial<Traits>)}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground"><Ruler className="size-3" /> Altura (cm)</p>
            <Input type="number" inputMode="numeric" min={130} max={220} placeholder="165" className="w-28"
              value={t.height_cm ?? ""} onChange={(e) => muda({ height_cm: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">Fuma?</p>
            <div className="flex gap-1.5">
              <button type="button" className={chip(t.smoker === false)} onClick={() => muda({ smoker: t.smoker === false ? null : false })}>Não</button>
              <button type="button" className={chip(t.smoker === true)} onClick={() => muda({ smoker: t.smoker === true ? null : true })}>Sim</button>
            </div>
          </div>
        </div>
      </div>

      <Button className="mt-4 w-full" disabled={!mudou || salvando} onClick={salvar}>
        {salvando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />} Salvar perfil
      </Button>
    </div>
  );
}

/** Características no perfil público, em etiquetas. Não mostra nada se o anunciante não preencheu. */
export function ProviderTraits({ providerId }: { providerId: string }) {
  const opcoes = useServiceOptions();
  const [t, setT] = useState<Traits | null>(null);
  useEffect(() => { let vivo = true; buscarTraits([providerId]).then(([r]) => { if (vivo) setT(r ?? null); }); return () => { vivo = false; }; }, [providerId]);
  if (!t) return null;

  const etiquetas: string[] = [];
  const r = (v: string | null) => (v ? opcoes.rotulo(v, "atributo") : "");
  if (t.age_range) etiquetas.push(`${r(t.age_range)} anos`);
  if (t.height_cm) etiquetas.push(`${(t.height_cm / 100).toFixed(2).replace(".", ",")} m`);
  if (t.ethnicity) etiquetas.push(r(t.ethnicity));
  if (t.hair) etiquetas.push(`Cabelo ${r(t.hair).toLowerCase()}`);
  if (t.body_type) etiquetas.push(r(t.body_type));
  for (const l of t.languages ?? []) etiquetas.push(r(l));
  if (t.smoker === false) etiquetas.push("Não fuma");
  if (t.smoker === true) etiquetas.push("Fuma");
  if (etiquetas.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {etiquetas.map((e) => (
        <span key={e} className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px]">{e}</span>
      ))}
    </div>
  );
}
