import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert, Users, Flag, CreditCard, Settings, Ticket, Loader2, Search,
  Ban, CheckCircle2, MessageSquare, X, Power, RefreshCw, Video, TrendingUp,
  Gauge, Gift, ScrollText, HelpCircle, UserMinus, Menu, Save,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ModalPortal } from "@/components/ModalPortal";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/fees";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração — Privora" }] }),
  component: () => <DashboardShell role="cliente"><AdminContent /></DashboardShell>,
});

/* ─── Tipos ─────────────────────────────────────────────────────────── */
interface Dash {
  denuncias_abertas: number; denuncias_menor: number; suspensos: number; verificacao_analise: number;
  usuarios: number; assinaturas_ativas: number; receita_30d: number; pedidos_pagos_30d: number;
  atendimentos_30d: number; concluidos_30d: number;
}
interface AdminUser {
  id: string; full_name: string; email: string | null; role: string; verification_status: string;
  is_suspended: boolean; suspended_reason: string | null; cnpj_ok: boolean; plan_name: string | null;
  plan_expires: string | null; rating_avg: number | null; rating_count: number; fotos: number; denuncias: number;
}
interface Report {
  id: string; created_at: string; reason: string; details: string | null; status: string;
  reported_id: string; reported_name: string; reported_role: string; reported_suspended: boolean;
  reporter_name: string; request_id: string | null; tem_conversa: boolean;
}
interface Order {
  id: string; created_at: string; paid_at: string | null; user_name: string; user_role: string;
  item_name: string; amount: number; method: string; status: string; provider: string | null;
}
interface Campaign {
  id: string; code: string; name: string; type: string; audience: string | null; discount_pct: number | null;
  trial_days: number | null; usos: number; max_redemptions: number | null; is_active: boolean; ends_at: string | null;
}
interface Plan { code: string; name: string; audience: string; price_month: number }
interface Setting { key: string; value: number; description: string | null }

const reasonLabel: Record<string, string> = {
  suspeita_menor: "🚨 Suspeita de menor", perfil_falso: "Perfil falso",
  violencia_ameaca: "Violência/ameaça", golpe: "Golpe", outro: "Outro",
};
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

/* ─── Tela ──────────────────────────────────────────────────────────── */
function AdminContent() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<
    "resumo" | "denuncias" | "usuarios" | "funil" | "videos" | "excluidas" |
    "pagamentos" | "planos" | "campanhas" | "legais" | "ajuda"
  >("resumo");
  const [menuAberto, setMenuAberto] = useState(false);
  const [dash, setDash] = useState<Dash | null>(null);

  const loadDash = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_dashboard");
    if (error) { setAllowed(false); return; }
    setAllowed(true); setDash(data as Dash);
  }, []);
  useEffect(() => { if (user) loadDash(); }, [user, loadDash]);

  if (allowed === null) return <Center><Loader2 className="size-7 animate-spin text-primary" /></Center>;
  if (!allowed) return (
    <Center>
      <ShieldAlert className="mb-3 size-12 text-destructive" />
      <p className="font-semibold">Área restrita</p>
      <p className="text-sm text-muted-foreground">Esta conta não tem acesso administrativo.</p>
    </Center>
  );

  interface ItemNav { id: string; label: string; icon: React.ReactNode; aviso?: number }
  const grupos: { titulo: string; itens: ItemNav[] }[] = [
    {
      titulo: "Visão geral",
      itens: [
        { id: "resumo", label: "Resumo", icon: <Gauge className="size-4" /> },
        { id: "funil", label: "Funil e saúde", icon: <TrendingUp className="size-4" /> },
      ],
    },
    {
      titulo: "Moderação",
      itens: [
        { id: "denuncias", label: "Denúncias", icon: <Flag className="size-4" />, aviso: dash?.denuncias_abertas ?? 0 },
        { id: "usuarios", label: "Usuários", icon: <Users className="size-4" /> },
        { id: "videos", label: "Vídeos", icon: <Video className="size-4" /> },
        { id: "excluidas", label: "Contas excluídas", icon: <UserMinus className="size-4" /> },
      ],
    },
    {
      titulo: "Receita",
      itens: [
        { id: "pagamentos", label: "Pagamentos", icon: <CreditCard className="size-4" /> },
        { id: "planos", label: "Planos e preços", icon: <Ticket className="size-4" /> },
        { id: "campanhas", label: "Campanhas", icon: <Gift className="size-4" /> },
      ],
    },
    {
      titulo: "Conteúdo",
      itens: [
        { id: "legais", label: "Termos e privacidade", icon: <ScrollText className="size-4" /> },
        { id: "ajuda", label: "Textos de ajuda", icon: <HelpCircle className="size-4" /> },
      ],
    },
  ];

  const tituloAtual = grupos.flatMap((g) => g.itens).find((i) => i.id === tab)?.label ?? "Administração";

  const Navegacao = ({ aoEscolher }: { aoEscolher?: () => void }) => (
    <nav className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.titulo}</p>
          <div className="space-y-0.5">
            {g.itens.map((i) => (
              <button key={i.id} onClick={() => { setTab(i.id as typeof tab); aoEscolher?.(); }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                  tab === i.id ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                {i.icon}
                <span className="flex-1 text-left">{i.label}</span>
                {Number(i.aviso ?? 0) > 0 && (
                  <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                    {i.aviso}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen" style={{ background: "#1E0E1A" }}>
      {/* Barra lateral fixa no desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card/40 px-3 py-5 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-3">
          <img src="/privora-selo.png" alt="" className="size-8 object-contain" />
          <div>
            <p className="text-sm font-semibold leading-tight">Privora</p>
            <p className="text-[10px] text-muted-foreground">Administração</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto"><Navegacao /></div>
        <Button variant="ghost" size="sm" className="mt-3 justify-start text-muted-foreground" onClick={loadDash}>
          <RefreshCw className="mr-2 size-4" /> Atualizar
        </Button>
      </aside>

      {/* Gaveta no celular */}
      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuAberto(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-border bg-card px-3 py-5"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between px-3">
              <p className="font-semibold">Administração</p>
              <Button variant="ghost" size="icon" onClick={() => setMenuAberto(false)}><X className="size-5" /></Button>
            </div>
            <Navegacao aoEscolher={() => setMenuAberto(false)} />
          </aside>
        </div>
      )}

      <main className="px-4 pb-16 pt-4 lg:ml-60 lg:px-8">
        <header className="mb-5 flex items-center gap-3 pt-2">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuAberto(true)}>
            <Menu className="size-5" />
          </Button>
          <h1 className="flex-1 text-xl font-semibold">{tituloAtual}</h1>
          {dash && (
            <span className="hidden text-xs text-muted-foreground sm:block">
              {dash.usuarios} usuários · {dash.atendimentos_30d} atendimentos em 30d
            </span>
          )}
        </header>

        <div className="mx-auto max-w-4xl lg:mx-0">
          {tab === "resumo" && <Resumo dash={dash} onRefresh={loadDash} />}
          {tab === "denuncias" && <Denuncias onChange={loadDash} />}
          {tab === "usuarios" && <Usuarios onChange={loadDash} />}
          {tab === "funil" && <Funil />}
          {tab === "videos" && <Videos />}
          {tab === "excluidas" && <Excluidas />}
          {tab === "pagamentos" && <Pagamentos />}
          {tab === "planos" && <Planos />}
          {tab === "campanhas" && <Campanhas />}
          {tab === "legais" && <Legais />}
          {tab === "ajuda" && <Ajuda />}
        </div>
      </main>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ background: "#1E0E1A" }}>{children}</main>;
}
function Card({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${alert && Number(value) > 0 ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${alert && Number(value) > 0 ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

/* ─── Resumo + interruptores ────────────────────────────────────────── */
function Resumo({ dash, onRefresh }: { dash: Dash | null; onRefresh: () => void }) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("platform_settings").select("key, value, description")
      .in("key", ["billing_enabled", "beta_all_features", "verification_required", "sanctions_enabled"]);
    setSettings((data as Setting[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(key: string, value: number) {
    const { error } = await supabase.rpc("admin_set_setting", { p_key: key, p_value: value });
    if (error) return toast.error(error.message);
    toast.success("Configuração salva.");
    load(); onRefresh();
  }

  const labels: Record<string, string> = {
    billing_enabled: "Cobrança ligada (usuários podem assinar)",
    beta_all_features: "Beta: todos com recursos do plano mais alto",
    verification_required: "Exigir verificação de idade para usar o app",
    sanctions_enabled: "Suspensão automática por nota baixa e cancelamentos",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Denúncias abertas" value={dash?.denuncias_abertas ?? 0} alert />
        <Card label="Suspeita de menor" value={dash?.denuncias_menor ?? 0} alert />
        <Card label="Suspensos" value={dash?.suspensos ?? 0} />
        <Card label="Em análise" value={dash?.verificacao_analise ?? 0} />
        <Card label="Usuários" value={dash?.usuarios ?? 0} />
        <Card label="Assinaturas ativas" value={dash?.assinaturas_ativas ?? 0} />
        <Card label="Receita 30 dias" value={brl(dash?.receita_30d ?? 0)} />
        <Card label="Atendimentos 30 dias" value={`${dash?.concluidos_30d ?? 0}/${dash?.atendimentos_30d ?? 0}`} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-2 font-semibold"><Power className="size-4" /> Interruptores</p>
        <div className="space-y-2">
          {settings.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm">{labels[s.key] ?? s.key}</p>
                <p className="text-[11px] text-muted-foreground">{s.description}</p>
              </div>
              <Button size="sm" variant={Number(s.value) === 1 ? "default" : "secondary"}
                onClick={() => toggle(s.key, Number(s.value) === 1 ? 0 : 1)}>
                {Number(s.value) === 1 ? "Ligado" : "Desligado"}
              </Button>
            </div>
          ))}
        </div>
      </section>
      <Button variant="secondary" className="w-full" onClick={onRefresh}><RefreshCw className="mr-2 size-4" /> Atualizar</Button>
    </div>
  );
}

/* ─── Denúncias ─────────────────────────────────────────────────────── */
function Denuncias({ onChange }: { onChange: () => void }) {
  const [filter, setFilter] = useState<"abertas" | "fechadas" | "todas">("abertas");
  const [rows, setRows] = useState<Report[] | null>(null);
  const [chat, setChat] = useState<{ report: Report; msgs: { created_at: string; sender_name: string; body: string }[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const { data } = await supabase.rpc("admin_reports", { p_status: filter, p_limit: 50 });
    setRows((data as Report[]) ?? []);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function act(r: Report, action: "procedente" | "improcedente" | "suspender" | "reativar") {
    setBusy(r.id);
    const { error } = action === "suspender" || action === "reativar"
      ? await supabase.rpc("admin_set_verification", { p_user_id: r.reported_id, p_status: action, p_note: reasonLabel[r.reason] })
      : await supabase.rpc("admin_resolve_report", { p_report_id: r.id, p_status: action, p_note: null });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Feito.");
    load(); onChange();
  }

  async function openChat(r: Report) {
    const { data, error } = await supabase.rpc("admin_report_chat", { p_report_id: r.id });
    if (error) return toast.error(error.message);
    setChat({ report: r, msgs: (data as { created_at: string; sender_name: string; body: string }[]) ?? [] });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["abertas", "fechadas", "todas"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{f}</button>
        ))}
      </div>

      {!rows ? <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />
        : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma denúncia.</p>
        : rows.map((r) => (
          <article key={r.id} className={`rounded-2xl border p-4 ${r.reason === "suspeita_menor" && r.status === "aberta" ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{reasonLabel[r.reason] ?? r.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {r.reported_name} ({r.reported_role}) · denunciado por {r.reporter_name} · {fmtDate(r.created_at)}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">{r.status}</Badge>
            </div>
            {r.details && <p className="mt-2 rounded-lg bg-secondary/50 p-2 text-xs italic text-muted-foreground">"{r.details}"</p>}
            {r.reported_suspended && <p className="mt-2 text-xs font-medium text-destructive">Perfil suspenso</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {r.tem_conversa && <Button size="sm" variant="secondary" onClick={() => openChat(r)}><MessageSquare className="mr-1.5 size-3.5" /> Ver conversa</Button>}
              {!r.reported_suspended
                ? <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => act(r, "suspender")}><Ban className="mr-1.5 size-3.5" /> Suspender</Button>
                : <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => act(r, "reativar")}><CheckCircle2 className="mr-1.5 size-3.5" /> Reativar</Button>}
              {["aberta", "em_analise"].includes(r.status) && (
                <>
                  <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => act(r, "procedente")}>Procedente</Button>
                  <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => act(r, "improcedente")}>Improcedente</Button>
                </>
              )}
            </div>
          </article>
        ))}

      {chat && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setChat(null)}>
            <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Conversa denunciada</p>
                <Button variant="ghost" size="icon" onClick={() => setChat(null)}><X className="size-5" /></Button>
              </div>
              {chat.msgs.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Sem mensagens.</p> : (
                <div className="space-y-2">
                  {chat.msgs.map((m, i) => (
                    <div key={i} className="rounded-xl border border-border p-2.5">
                      <p className="text-[11px] text-muted-foreground">{m.sender_name} · {fmtDate(m.created_at)}</p>
                      <p className="mt-0.5 text-sm">{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

/* ─── Usuários ──────────────────────────────────────────────────────── */
function Usuarios({ onChange }: { onChange: () => void }) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setRows(null);
    const { data, error } = await supabase.rpc("admin_users", { p_search: q || null, p_limit: 50 });
    if (error) toast.error(error.message);
    setRows((data as AdminUser[]) ?? []);
  }, []);
  useEffect(() => { load(""); }, [load]);

  async function act(u: AdminUser, status: string) {
    setBusy(u.id);
    const { error } = await supabase.rpc("admin_set_verification", { p_user_id: u.id, p_status: status, p_note: null });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Atualizado.");
    load(search); onChange();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail"
          onKeyDown={(e) => e.key === "Enter" && load(search)} />
        <Button onClick={() => load(search)}><Search className="size-4" /></Button>
      </div>

      {!rows ? <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />
        : rows.map((u) => (
          <article key={u.id} className={`rounded-2xl border p-4 ${u.is_suspended ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email} · {u.role}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="secondary" className={`text-[10px] ${u.verification_status === "aprovado" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {u.verification_status}
                </Badge>
                {u.denuncias > 0 && <Badge variant="secondary" className="bg-destructive/20 text-[10px] text-destructive">{u.denuncias} denúncia(s)</Badge>}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Plano {u.plan_name ?? "—"}{u.plan_expires ? ` até ${new Date(u.plan_expires).toLocaleDateString("pt-BR")}` : ""}
              {u.role === "prestador" && ` · ${u.fotos} foto(s) · ${Number(u.rating_avg ?? 0).toFixed(1)}★ (${u.rating_count})`}
              {u.role === "parceiro" && ` · CNPJ ${u.cnpj_ok ? "confirmado" : "pendente"}`}
            </p>
            {u.is_suspended && <p className="mt-1 text-xs text-destructive">{u.suspended_reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {u.verification_status !== "aprovado" && <Button size="sm" variant="secondary" disabled={busy === u.id} onClick={() => act(u, "aprovado")}>Aprovar</Button>}
              {u.verification_status === "aprovado" && <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => act(u, "reprovado")}>Reprovar</Button>}
              {!u.is_suspended
                ? <Button size="sm" variant="secondary" disabled={busy === u.id} onClick={() => act(u, "suspender")}><Ban className="mr-1.5 size-3.5" /> Suspender</Button>
                : <Button size="sm" variant="secondary" disabled={busy === u.id} onClick={() => act(u, "reativar")}>Reativar</Button>}
            </div>
          </article>
        ))}
    </div>
  );
}

/* ─── Funil e saúde do marketplace ──────────────────────────────────── */
interface EtapaFunil { publico: string; etapa: string; ordem: number; pessoas: number; pct_do_topo: number }
interface Sinal { indicador: string; valor: string; situacao: string }
interface Dia { dia: string; cadastros: number; chamados: number; propostas: number; concluidos: number; receita: number }

function Funil() {
  const [dias, setDias] = useState(30);
  const [etapas, setEtapas] = useState<EtapaFunil[] | null>(null);
  const [sinais, setSinais] = useState<Sinal[]>([]);
  const [atividade, setAtividade] = useState<Dia[]>([]);

  const load = useCallback(async () => {
    setEtapas(null);
    const [f, h, a] = await Promise.all([
      supabase.rpc("admin_funnel", { p_days: dias }),
      supabase.rpc("admin_health"),
      supabase.rpc("admin_activity", { p_days: 14 }),
    ]);
    if (f.error) toast.error(f.error.message);
    setEtapas((f.data as EtapaFunil[]) ?? []);
    setSinais((h.data as Sinal[]) ?? []);
    setAtividade((a.data as Dia[]) ?? []);
  }, [dias]);
  useEffect(() => { load(); }, [load]);

  const publicos = ["cliente", "prestador", "parceiro"];
  const maxDia = Math.max(1, ...atividade.map((d) => Math.max(d.cadastros, d.chamados, d.concluidos)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Onde as pessoas param</h2>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDias(d)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${dias === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Sinais de alerta */}
      <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">SAÚDE DO MARKETPLACE</p>
        {sinais.map((s) => (
          <div key={s.indicador} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{s.indicador}</span>
            <span className="shrink-0"><b>{s.valor}</b> <span className="text-xs">{s.situacao}</span></span>
          </div>
        ))}
      </div>

      {/* Funil por público */}
      {!etapas ? <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" /> :
        publicos.map((pub) => {
          const linhas = etapas.filter((e) => e.publico === pub);
          if (!linhas.length) return null;
          return (
            <div key={pub} className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">{pub}</p>
              <div className="space-y-2">
                {linhas.map((e) => (
                  <div key={e.etapa}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{e.etapa}</span>
                      <span className="text-muted-foreground">{e.pessoas} · {e.pct_do_topo}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, e.pct_do_topo)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      {/* Atividade diária */}
      {atividade.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">ÚLTIMOS 14 DIAS</p>
          <div className="flex h-24 items-end gap-1">
            {atividade.map((d) => (
              <div key={d.dia} className="flex flex-1 flex-col items-center gap-1"
                title={`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${d.cadastros} cadastros, ${d.chamados} chamados, ${d.concluidos} concluídos`}>
                <div className="flex w-full flex-1 items-end gap-px">
                  <div className="flex-1 rounded-t bg-primary/70" style={{ height: `${(d.chamados / maxDia) * 100}%` }} />
                  <div className="flex-1 rounded-t bg-accent" style={{ height: `${(d.cadastros / maxDia) * 100}%` }} />
                  <div className="flex-1 rounded-t bg-green-500/70" style={{ height: `${(d.concluidos / maxDia) * 100}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground">{new Date(d.dia).getDate()}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            <span className="text-primary">■</span> chamados ·
            <span className="text-accent"> ■</span> cadastros ·
            <span className="text-green-500"> ■</span> concluídos
          </p>
        </div>
      )}
    </div>
  );
}


/* ─── Contas excluídas ──────────────────────────────────────────────── */
interface ContaExcluida { deleted_at: string; role: string; verification_status: string; had_reports: number; reason: string | null }

function Excluidas() {
  const [rows, setRows] = useState<ContaExcluida[] | null>(null);
  useEffect(() => {
    supabase.rpc("admin_deleted_accounts", { p_limit: 50 }).then(({ data, error }) => {
      if (error) toast.error(error.message);
      setRows((data as ContaExcluida[]) ?? []);
    });
  }, []);

  if (!rows) return <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />;
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma conta excluída.</p>;

  return (
    <div className="space-y-2">
      <p className="mb-3 text-xs text-muted-foreground">
        Guardamos só o registro de que a verificação de idade foi feita, por 5 anos. Sem nome, CPF ou telefone.
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{r.role} · verificação {r.verification_status ?? "—"}</p>
            {r.reason && <p className="truncate text-xs italic text-muted-foreground">"{r.reason}"</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">{new Date(r.deleted_at).toLocaleDateString("pt-BR")}</p>
            {r.had_reports > 0 && <p className="text-[10px] text-destructive">{r.had_reports} denúncia(s)</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Termos e privacidade ──────────────────────────────────────────── */
function Legais() {
  const [slug, setSlug] = useState<"termos" | "privacidade">("termos");
  const [doc, setDoc] = useState<{ version: number; title: string; body: string } | null>(null);
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aceites, setAceites] = useState<{ slug: string; version: number; aceitaram: number; total_usuarios: number }[]>([]);

  const load = useCallback(async () => {
    setDoc(null);
    const [d, a] = await Promise.all([
      supabase.rpc("legal_document", { p_slug: slug }),
      supabase.rpc("admin_agreements_report"),
    ]);
    const atual = d.data as { version: number; title: string; body: string } | null;
    setDoc(atual);
    setTexto(atual?.body ?? "");
    setTitulo(atual?.title ?? (slug === "termos" ? "Termos de Uso" : "Política de Privacidade"));
    setAceites((a.data as typeof aceites) ?? []);
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  async function publicar() {
    if (!window.confirm("Publicar nova versão? Todos os usuários terão de aceitar de novo no próximo acesso.")) return;
    setSalvando(true);
    const { error } = await supabase.rpc("admin_publish_legal", { p_slug: slug, p_title: titulo, p_body: texto });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Nova versão publicada.");
    load();
  }

  const aceite = aceites.find((a) => a.slug === slug);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["termos", "privacidade"] as const).map((v) => (
          <button key={v} onClick={() => setSlug(v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${slug === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {v === "termos" ? "Termos de Uso" : "Política de Privacidade"}
          </button>
        ))}
      </div>

      {doc && (
        <p className="text-xs text-muted-foreground">
          Versão {doc.version} no ar
          {aceite && ` · ${aceite.aceitaram} de ${aceite.total_usuarios} usuários aceitaram`}
        </p>
      )}

      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" />
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={22}
        className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed"
        placeholder="Cole aqui o texto revisado pelo advogado. Use ## para títulos e - para listas." />

      <div className="flex items-center gap-2">
        <Button disabled={salvando || texto.length < 200} onClick={publicar}>
          {salvando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Publicar nova versão
        </Button>
        <p className="text-[11px] text-muted-foreground">A versão anterior fica guardada como histórico.</p>
      </div>
    </div>
  );
}

/* ─── Textos de ajuda ───────────────────────────────────────────────── */
interface Ajudinha { id: string; screen: string; title: string; body: string; sort_order: number }

function Ajuda() {
  const [tela, setTela] = useState("cliente");
  const [itens, setItens] = useState<Ajudinha[] | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const load = useCallback(async () => {
    setItens(null);
    const { data, error } = await supabase
      .from("help_content").select("id, screen, title, body, sort_order")
      .eq("screen", tela).order("sort_order");
    if (error) toast.error(error.message);
    setItens((data as Ajudinha[]) ?? []);
  }, [tela]);
  useEffect(() => { load(); }, [load]);

  async function salvar(id: string) {
    const { error } = await supabase.from("help_content").update({ body: rascunho }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Texto atualizado.");
    setEditando(null); load();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {["cliente", "prestador", "parceiro"].map((t) => (
          <button key={t} onClick={() => setTela(t)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tela === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">São os textos do botão "?" dentro do app.</p>

      {!itens ? <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" /> :
        itens.map((i) => (
          <div key={i.id} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-semibold">{i.title}</p>
            {editando === i.id ? (
              <>
                <textarea value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={5}
                  className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-xs" />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => salvar(i.id)}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.body}</p>
                <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs"
                  onClick={() => { setEditando(i.id); setRascunho(i.body); }}>
                  Editar
                </Button>
              </>
            )}
          </div>
        ))}
    </div>
  );
}

/* ─── Moderação de vídeos ───────────────────────────────────────────── */
interface AdminVideo { user_id: string; provider_name: string; video_url: string; status: string; admin_note: string | null; updated_at: string }

function Videos() {
  const [status, setStatus] = useState("em_revisao");
  const [rows, setRows] = useState<AdminVideo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const { data, error } = await supabase.rpc("admin_videos", { p_status: status });
    if (error) toast.error(error.message);
    setRows((data as AdminVideo[]) ?? []);
  }, [status]);
  useEffect(() => { load(); }, [load]);

  async function moderar(v: AdminVideo, novo: string) {
    const nota = novo === "reprovado" ? window.prompt("Motivo da reprovação (o prestador vê):") : null;
    if (novo === "reprovado" && !nota) return;
    setBusy(v.user_id);
    const { error } = await supabase.rpc("admin_moderate_video", { p_user_id: v.user_id, p_status: novo, p_note: nota });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Feito."); load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["em_revisao", "aprovado", "reprovado", "todos"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      {!rows ? <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />
        : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum vídeo.</p>
        : rows.map((v) => (
          <article key={v.user_id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{v.provider_name}</p>
              <Badge variant="secondary" className="text-[10px]">{v.status.replace("_", " ")}</Badge>
            </div>
            <video src={v.video_url} controls playsInline className="mt-2 w-full rounded-xl bg-black" />
            {v.admin_note && <p className="mt-2 text-xs text-muted-foreground">{v.admin_note}</p>}
            <div className="mt-3 flex gap-2">
              {v.status !== "aprovado" && <Button size="sm" disabled={busy === v.user_id} onClick={() => moderar(v, "aprovado")}>Aprovar</Button>}
              {v.status !== "reprovado" && <Button size="sm" variant="destructive" disabled={busy === v.user_id} onClick={() => moderar(v, "reprovado")}>Reprovar</Button>}
            </div>
          </article>
        ))}
    </div>
  );
}

/* ─── Pagamentos ────────────────────────────────────────────────────── */
function Pagamentos() {
  const [status, setStatus] = useState("todos");
  const [rows, setRows] = useState<Order[] | null>(null);
  useEffect(() => {
    setRows(null);
    supabase.rpc("admin_orders", { p_status: status, p_limit: 50 }).then(({ data }) => setRows((data as Order[]) ?? []));
  }, [status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["todos", "pago", "pendente", "expirado", "estornado"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{s}</button>
        ))}
      </div>
      {!rows ? <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />
        : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pagamento.</p>
        : rows.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{o.item_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {o.user_name} ({o.user_role}) · {o.method}{o.provider ? ` · ${o.provider}` : ""} · {fmtDate(o.paid_at ?? o.created_at)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-bold text-primary">{brl(o.amount)}</p>
              <Badge variant="secondary" className={`text-[10px] ${o.status === "pago" ? "bg-green-500/20 text-green-400" : o.status === "estornado" ? "bg-destructive/20 text-destructive" : ""}`}>{o.status}</Badge>
            </div>
          </div>
        ))}
    </div>
  );
}

/* ─── Planos e preços ───────────────────────────────────────────────── */
function Planos() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [products, setProducts] = useState<{ code: string; name: string; price: number }[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from("plans").select("code, name, audience, price_month").order("audience").order("sort_order"),
      supabase.from("billing_products").select("code, name, price"),
    ]);
    setPlans((p as Plan[]) ?? []);
    setProducts((pr as { code: string; name: string; price: number }[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(code: string) {
    const value = parseFloat((edit[code] ?? "").replace(",", "."));
    if (isNaN(value) || value < 0) return toast.error("Valor inválido.");
    const { error } = await supabase.rpc("admin_set_plan_price", { p_code: code, p_price: value });
    if (error) return toast.error(error.message);
    toast.success("Preço atualizado.");
    setEdit((e) => ({ ...e, [code]: "" })); load();
  }

  const Row = ({ code, name, audience, price }: { code: string; name: string; audience: string; price: number }) => (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-[11px] text-muted-foreground">{audience} · {code} · atual {brl(price)}</p>
      </div>
      <Input className="w-24" inputMode="decimal" placeholder={String(price)}
        value={edit[code] ?? ""} onChange={(e) => setEdit((s) => ({ ...s, [code]: e.target.value }))} />
      <Button size="sm" disabled={!edit[code]} onClick={() => save(code)}>Salvar</Button>
    </div>
  );

  if (!plans) return <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />;
  return (
    <div className="space-y-2">
      {plans.map((p) => <Row key={p.code} code={p.code} name={p.name} audience={p.audience} price={Number(p.price_month)} />)}
      {products.map((p) => <Row key={p.code} code={p.code} name={p.name} audience="avulso" price={Number(p.price)} />)}
      <p className="pt-2 text-[11px] text-muted-foreground">
        Preço 0 deixa o plano gratuito. Recursos de cada plano (fotos, limites) ainda são editados no banco, em plan_features.
      </p>
    </div>
  );
}

/* ─── Campanhas ─────────────────────────────────────────────────────── */
function Campanhas() {
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({ code: "", name: "", type: "cupom_desconto", plan: "", discount: "", days: "", max: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, { data: p }] = await Promise.all([
      supabase.rpc("admin_campaigns"),
      supabase.from("plans").select("code, name, audience, price_month").gt("price_month", 0),
    ]);
    setRows((data as Campaign[]) ?? []);
    setPlans((p as Plan[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_campaign", {
      p_code: form.code, p_name: form.name || form.code, p_type: form.type,
      p_plan_code: form.plan || null,
      p_discount_pct: form.discount ? Number(form.discount) : null,
      p_trial_days: form.days ? Number(form.days) : null,
      p_max_redemptions: form.max ? Number(form.max) : null,
      p_ends_at: null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Campanha criada!");
    setForm({ code: "", name: "", type: "cupom_desconto", plan: "", discount: "", days: "", max: "" });
    load();
  }

  async function toggle(c: Campaign) {
    const { error } = await supabase.rpc("admin_toggle_campaign", { p_id: c.id, p_active: !c.is_active });
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <p className="font-semibold">Nova campanha</p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="CÓDIGO" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="uppercase" />
          <Input placeholder="Nome interno" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="flex gap-2">
          {([["cupom_desconto", "Cupom de desconto"], ["teste_gratis", "Teste grátis"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setForm({ ...form, type: v })}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium ${form.type === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
          className="w-full rounded-xl border border-border bg-card p-2.5 text-sm">
          <option value="">{form.type === "cupom_desconto" ? "Qualquer plano" : "Escolha o plano"}</option>
          {plans.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.audience}) — {brl(p.price_month)}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          {form.type === "cupom_desconto"
            ? <Input placeholder="Desconto %" inputMode="numeric" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            : <Input placeholder="Dias grátis" inputMode="numeric" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />}
          <Input placeholder="Limite de usos" inputMode="numeric" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
        </div>
        <Button className="w-full" disabled={busy || !form.code} onClick={create}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Criar campanha
        </Button>
      </section>

      {!rows ? <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />
        : rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.code} <span className="font-normal text-muted-foreground">· {c.name}</span></p>
              <p className="text-[11px] text-muted-foreground">
                {c.type === "cupom_desconto" ? `${c.discount_pct}% de desconto` : `${c.trial_days} dias grátis`}
                {c.audience ? ` · ${c.audience}` : ""} · {c.usos}{c.max_redemptions ? `/${c.max_redemptions}` : ""} uso(s)
              </p>
            </div>
            <Button size="sm" variant={c.is_active ? "secondary" : "ghost"} onClick={() => toggle(c)}>
              {c.is_active ? "Ativa" : "Pausada"}
            </Button>
          </div>
        ))}
    </div>
  );
}
