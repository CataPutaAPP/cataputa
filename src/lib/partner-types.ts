/** Tipos de local parceiro: rótulo e letra que aparece no ponto do mapa. */
export const PARTNER_TYPES = [
  { value: "motel",   label: "Motel",               icone: "M" },
  { value: "hotel",   label: "Hotel",               icone: "H" },
  { value: "clinica", label: "Clínica de massagem", icone: "C" },
  { value: "swing",   label: "Casa de swing",       icone: "Ψ" }, // tridente
  { value: "drive",   label: "Drive",               icone: "D" },
  { value: "hostel",  label: "Hostel",              icone: "H" },
  { value: "quarto",  label: "Quarto",              icone: "Q" },
  { value: "garagem", label: "Garagem",             icone: "G" },
  { value: "outro",   label: "Outro",               icone: "P" },
] as const;

export const partnerIcon = (tipo: string | null | undefined) =>
  PARTNER_TYPES.find((t) => t.value === tipo)?.icone ?? "P";

export const partnerLabel = (tipo: string | null | undefined) =>
  PARTNER_TYPES.find((t) => t.value === tipo)?.label ?? "Local parceiro";
