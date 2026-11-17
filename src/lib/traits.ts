import { supabase } from "@/lib/supabase";

/** Características que o anunciante declara no perfil e que viram filtro de busca. */
export interface Traits {
  id: string;
  bio: string | null;
  ethnicity: string | null;
  hair: string | null;
  body_type: string | null;
  age_range: string | null;
  height_cm: number | null;
  languages: string[] | null;
  smoker: boolean | null;
}

/** Campos de escolha (os valores vêm do catálogo, grupo "atributo"). */
export const CAMPOS_TRAITS = [
  { campo: "ethnicity", titulo: "Etnia" },
  { campo: "hair", titulo: "Cabelo" },
  { campo: "body_type", titulo: "Corpo" },
  { campo: "age_range", titulo: "Faixa de idade" },
  { campo: "languages", titulo: "Idiomas" },
] as const;
export type CampoTrait = (typeof CAMPOS_TRAITS)[number]["campo"];

const BASE = "id, bio, hair, body_type, age_range, height_cm, languages, smoker";
let temEtnia: boolean | null = null;   // null = ainda não sabemos se a coluna existe no banco

/** Busca as características de vários perfis de uma vez. Funciona mesmo se a coluna de etnia ainda não existir. */
export async function buscarTraits(ids: string[]): Promise<Traits[]> {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (unicos.length === 0) return [];
  if (temEtnia !== false) {
    const r = await supabase.from("profiles").select(`${BASE}, ethnicity`).in("id", unicos);
    if (!r.error) { temEtnia = true; return (r.data as unknown as Traits[]) ?? []; }
    temEtnia = false;
  }
  const r = await supabase.from("profiles").select(BASE).in("id", unicos);
  return ((r.data as unknown as Omit<Traits, "ethnicity">[]) ?? []).map((t) => ({ ...t, ethnicity: null }));
}

export const etniaDisponivel = () => temEtnia !== false;

/** O perfil passa nos filtros escolhidos? Cada campo com filtro precisa bater com pelo menos uma opção. */
export function passaNosFiltros(t: Traits | undefined, filtros: Partial<Record<CampoTrait, string[]>>): boolean {
  for (const { campo } of CAMPOS_TRAITS) {
    const quero = filtros[campo];
    if (!quero || quero.length === 0) continue;
    if (!t) return false;
    if (campo === "languages") {
      if (!(t.languages ?? []).some((l) => quero.includes(l))) return false;
    } else {
      const v = t[campo];
      if (!v || !quero.includes(v)) return false;
    }
  }
  return true;
}
