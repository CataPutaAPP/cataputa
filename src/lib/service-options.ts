/* ─── Shared service options (cliente + prestador) ──────────────────── */

export type ServiceType = "massagem" | "acompanhante";
export type LocalOption = "local_atendente" | "parceiro" | "local_cliente" | "carro";

export const serviceSubTypes: Record<ServiceType, { value: string; label: string }[]> = {
  massagem: [
    { value: "tantrica", label: "Tântrica" },
    { value: "lingam", label: "Lingam" },
    { value: "nuru", label: "Nuru" },
    { value: "vivencia", label: "Vivência" },
    { value: "sensitiva", label: "Sensitiva" },
    { value: "tailandesa", label: "Tailandesa" },
    { value: "yoni", label: "Yoni" },
    { value: "tradicional", label: "Tradicional (Relaxante)" },
  ],
  acompanhante: [
    { value: "15min", label: "15 minutos" },
    { value: "30min", label: "30 minutos" },
    { value: "60min", label: "60 minutos" },
    { value: "120min", label: "120 minutos" },
    { value: "no_carro", label: "No carro" },
  ],
};

export const serviceFlags = [
  { value: "anal_preservativo", label: "Sexo anal com preservativo" },
  { value: "vaginal_preservativo", label: "Sexo vaginal com preservativo" },
  { value: "beijo_boca", label: "Beijo na boca" },
  { value: "oral_preservativo", label: "Sexo oral com preservativo" },
  { value: "striptease", label: "Striptease" },
  { value: "masturbacao", label: "Masturbação" },
  { value: "massagem", label: "Massagem" },
  { value: "dominacao", label: "Dominação" },
  { value: "usa_acessorios", label: "Usa acessórios" },
  { value: "inversao_papel", label: "Inversão de papel" },
  { value: "beijo_grego", label: "Beijo grego" },
  { value: "podolatria", label: "Podolatria" },
  { value: "massagem_prostatica", label: "Massagem prostática" },
];

export const genderOptions = [
  { value: "mulheres", label: "Mulheres" },
  { value: "homens", label: "Homens" },
  { value: "travesti", label: "Travesti" },
];

export const radiusOptions = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
];

/** Opções que o CLIENTE escolhe ao abrir um chamado */
export const localOptions: { value: LocalOption; label: string; desc: string }[] = [
  { value: "local_cliente", label: "Tenho local", desc: "O prestador vem até você" },
  { value: "local_atendente", label: "No local do prestador", desc: "Você vai até o prestador" },
  { value: "parceiro", label: "Usar parceiro", desc: "Você escolhe um quarto de parceiro antes de pagar" },
];

/** Opções que o PRESTADOR escolhe ao propor ou ofertar */
export const providerLocalOptions: { value: LocalOption; label: string }[] = [
  { value: "local_atendente", label: "Tenho local" },
  { value: "local_cliente", label: "Vou até o cliente" },
  { value: "parceiro", label: "Parceiro" },
];

/** Subtipo "no carro": local é sempre 'carro' e o ponto é a localização do prestador */
export const CARRO_SUBTYPE = "no_carro";
export const isCarro = (subType?: string | null) => subType === CARRO_SUBTYPE;

export function getLocalLabel(v: LocalOption | string | null | undefined, perspective: "cliente" | "prestador" = "cliente"): string {
  switch (v) {
    case "local_atendente": return perspective === "cliente" ? "Local do prestador" : "Meu local";
    case "local_cliente": return perspective === "cliente" ? "Meu local" : "Local do cliente";
    case "parceiro": return "Parceiro";
    case "carro": return "No carro";
    default: return "—";
  }
}

export function getSubLabel(type: ServiceType, sub: string): string {
  return serviceSubTypes[type]?.find((x) => x.value === sub)?.label ?? sub;
}
