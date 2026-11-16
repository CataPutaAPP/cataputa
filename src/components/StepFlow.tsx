import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Check, ChevronLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Formulário em etapas (assistente): uma decisão por tela, barra de progresso,
 * resumo do que já foi escolhido e botão fixo no rodapé.
 * Usado em "Nova solicitação" (cliente) e "Ofertar serviço" (prestador).
 */
export interface FlowStep {
  key: string;
  titulo: string;
  dica?: string | undefined;
  /** pode avançar? */
  pronto: boolean;
  /** texto curto mostrado no resumo depois de respondido */
  resumo?: string | null | undefined;
  /** recebe avancar() para escolhas únicas avançarem sozinhas */
  conteudo: (avancar: () => void) => ReactNode;
}

export function StepFlow({ titulo, passos, onClose, finalLabel, finalIcon: FinalIcon, enviando, onEnviar }: {
  titulo: string;
  passos: FlowStep[];
  onClose: () => void;
  finalLabel: string;
  finalIcon?: ComponentType<{ className?: string }>;
  enviando?: boolean;
  onEnviar: () => void;
}) {
  const [i, setI] = useState(0);
  // etapas mudam conforme as respostas; nunca fica apontando para uma que sumiu
  useEffect(() => { if (i > passos.length - 1) setI(Math.max(0, passos.length - 1)); }, [passos.length, i]);

  const atual = passos[Math.min(i, passos.length - 1)] ?? passos[0];
  if (!atual) return null;
  const ultimo = i >= passos.length - 1;
  const avancar = () => setTimeout(() => setI((v) => v + 1), 160); // deixa o toque "acender" antes de trocar
  const resumo = passos.slice(0, i).filter((p) => p.resumo);

  return (
    <div className="fixed app-sheet z-40 flex h-[88dvh] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl lg:h-auto lg:rounded-none lg:border-r lg:border-t-0">
      {/* Cabeçalho: voltar / fechar + progresso */}
      <div className="shrink-0 px-5 pt-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border lg:hidden" />
        <div className="flex items-center gap-2">
          {i > 0 ? (
            <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => setI((v) => v - 1)}><ChevronLeft className="size-5" /></Button>
          ) : <span className="size-9" />}
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{titulo}</p>
            <p className="text-[11px] text-muted-foreground">Passo {Math.min(i, passos.length - 1) + 1} de {passos.length}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X className="size-5" /></Button>
        </div>
        <div className="mt-3 flex gap-1.5">
          {passos.map((p, n) => (
            <span key={p.key} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${n < i ? "bg-primary" : n === i ? "bg-primary/60" : "bg-border"}`} />
          ))}
        </div>
      </div>

      {/* Etapa atual */}
      <div key={atual.key} className="flex-1 overflow-y-auto px-5 pb-4 pt-6 animate-in fade-in slide-in-from-right-3 duration-200">
        <h3 className="text-2xl leading-tight">{atual.titulo}</h3>
        {atual.dica && <p className="mt-1.5 text-sm text-muted-foreground">{atual.dica}</p>}
        <div className="mt-5">{atual.conteudo(avancar)}</div>
      </div>

      {/* Rodapé fixo: resumo + ação */}
      <div className="shrink-0 border-t border-border bg-card/95 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        {resumo.length > 0 && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
            {resumo.map((p) => (
              <button key={p.key} onClick={() => setI(passos.findIndex((x) => x.key === p.key))}
                className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/70">
                {p.resumo}
              </button>
            ))}
          </div>
        )}
        {ultimo ? (
          <Button className="h-13 w-full text-base shadow-glow" disabled={!atual.pronto || enviando} onClick={onEnviar}>
            {enviando ? <Loader2 className="mr-2 size-5 animate-spin" /> : FinalIcon ? <FinalIcon className="mr-2 size-5" /> : null}
            {enviando ? "Enviando..." : finalLabel}
          </Button>
        ) : (
          <Button className="h-13 w-full text-base" disabled={!atual.pronto} onClick={() => setI((v) => v + 1)}>
            Continuar
          </Button>
        )}
      </div>
    </div>
  );
}

/** Cartão grande de escolha única: ícone, título, descrição e marca de selecionado. */
export function ChoiceCard({ icon: Icon, titulo, desc, ativo, desabilitado, onClick }: {
  icon?: ComponentType<{ className?: string }>;
  titulo: string;
  desc?: string;
  ativo: boolean;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={desabilitado}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
        desabilitado ? "cursor-not-allowed border-border opacity-45"
        : ativo ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-background/40 hover:border-primary/40 hover:bg-secondary/60"}`}>
      {Icon && (
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${ativo ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
          <Icon className="size-6" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-base font-semibold ${ativo ? "text-primary" : ""}`}>{titulo}</span>
        {desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>}
      </span>
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
        {ativo && <Check className="size-3.5" />}
      </span>
    </button>
  );
}

/** Opção em pílula — para listas de escolha única curta ou múltipla. */
export function ChoiceChip({ ativo, onClick, children, bloqueado }: { ativo: boolean; onClick: () => void; children: ReactNode; bloqueado?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.97] ${
        ativo ? "border-primary bg-primary text-primary-foreground" : bloqueado ? "border-border text-muted-foreground/60" : "border-border bg-background/40 text-foreground hover:border-primary/40"}`}>
      {ativo && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

/** Linha do resumo final. */
export function ReviewRow({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
