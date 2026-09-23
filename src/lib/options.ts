import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  serviceSubTypes, serviceFlags, genderOptions, type ServiceType,
} from "@/lib/service-options";

export interface Opcao { grupo: string; aplica_a: string | null; value: string; label: string; sort_order: number }

/** Tipos que usam duração em vez de estilo, e os que não usam nenhum dos dois. */
export const TIPOS_COM_DURACAO = ["acompanhante", "pernoite", "viagem"];
export const TIPOS_SEM_DETALHE = ["jantar", "virtual"];

/** Durações que fazem sentido em cada tipo. */
const DURACAO_POR_TIPO: Record<string, string[]> = {
  acompanhante: ["30min", "60min", "120min", "240min", "pernoite"],
  pernoite: ["pernoite", "diaria"],
  viagem: ["diaria", "fim_semana"],
};

/**
 * Opções de serviço vindas do banco (tabela service_options).
 * Se o catálogo ainda não existir, cai nas listas antigas do código —
 * assim o app nunca fica sem opção na tela.
 */
export function useServiceOptions() {
  const [todas, setTodas] = useState<Opcao[] | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("service_options_list");
    if (error || !data) { setTodas([]); return; }
    setTodas(data as Opcao[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const doGrupo = (grupo: string, aplicaA?: string) =>
    (todas ?? []).filter((o) => o.grupo === grupo && (aplicaA === undefined || o.aplica_a === aplicaA));

  const temCatalogo = (todas?.length ?? 0) > 0;

  const tipos = temCatalogo
    ? doGrupo("tipo_servico").map((o) => ({ value: o.value, label: o.label }))
    : [{ value: "massagem", label: "Massagem" }, { value: "acompanhante", label: "Acompanhante" }];

  const praticas = temCatalogo
    ? doGrupo("pratica").map((o) => ({ value: o.value, label: o.label }))
    : serviceFlags;

  const generos = temCatalogo
    ? doGrupo("genero").map((o) => ({ value: o.value, label: o.label }))
    : genderOptions;

  const publicos = temCatalogo
    ? doGrupo("publico").map((o) => ({ value: o.value, label: o.label }))
    : [];

  const estilos = temCatalogo
    ? doGrupo("estilo_massagem", "massagem").map((o) => ({ value: o.value, label: o.label }))
    : serviceSubTypes.massagem;

  /** Duração válida para o tipo escolhido, na ordem do catálogo. */
  const duracoes = (tipo: string) => {
    const permitidas = DURACAO_POR_TIPO[tipo];
    const lista = temCatalogo
      ? doGrupo("duracao").map((o) => ({ value: o.value, label: o.label }))
      : serviceSubTypes.acompanhante;
    return permitidas ? lista.filter((d) => permitidas.includes(d.value)) : lista;
  };

  const atributos = (campo: string) =>
    doGrupo("atributo", campo).map((o) => ({ value: o.value, label: o.label }));

  /** Rótulo bonito de qualquer valor guardado no banco. */
  const rotulo = (valor: string | null | undefined, grupo?: string) => {
    if (!valor) return "";
    const achado = (todas ?? []).find((o) => o.value === valor && (!grupo || o.grupo === grupo));
    if (achado) return achado.label;
    const antigo = [...serviceFlags, ...genderOptions, ...serviceSubTypes.massagem,
                    ...serviceSubTypes.acompanhante].find((x) => x.value === valor);
    return antigo?.label ?? valor;
  };

  /** Qual campo de detalhe mostrar para um tipo de serviço. */
  const detalheDoTipo = (tipo: string): "estilo" | "duracao" | "nenhum" => {
    if (tipo === "massagem") return "estilo";
    if (TIPOS_SEM_DETALHE.includes(tipo)) return "nenhum";
    return "duracao";
  };

  return { carregando: todas === null, tipos, praticas, generos, publicos, estilos,
           duracoes, atributos, rotulo, detalheDoTipo, temCatalogo };
}

/** Tipos antigos aceitos pelo app (para conversões pontuais). */
export type TipoServico = ServiceType | "jantar" | "pernoite" | "viagem" | "virtual";
