// ============================================================================
// PainelPrestador.tsx — Painel do prestador
//
// Resolve três problemas relatados:
//   1. Prestador não tinha painel das próprias ofertas   -> lista via my_offers()
//   2. Botão "Online" não gravava nada                   -> chama set_availability()
//   3. "Perfil incompleto 0/3" com fotos salvas          -> lê provider_photos direto
//
// E mostra SEMPRE a mensagem real do banco (error.message) em vez de
// "Erro ao processar" — é o que transforma cada bug numa leitura de 5 segundos.
//
// AJUSTE O IMPORT ABAIXO se o caminho do seu cliente Supabase for outro.
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Oferta = {
  offer_id: string;
  service_type: string;
  sub_type: string | null;
  flags: string[] | null;
  price: number;
  local_option: string;
  description: string | null;
  ativa: boolean;
  created_at: string;
};

const MIN_FOTOS = 3;

export default function PainelPrestador() {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [fotos, setFotos] = useState<number | null>(null);
  const [online, setOnline] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvandoOnline, setSalvandoOnline] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data: sessao } = await supabase.auth.getUser();
    const uid = sessao?.user?.id;
    if (!uid) {
      setErro("Sessão expirada. Entre novamente.");
      setCarregando(false);
      return;
    }

    // as três consultas em paralelo: joins por atalho de FK falham em silêncio
    const [resOfertas, resFotos, resDisp] = await Promise.all([
      supabase.rpc("my_offers"),
      supabase
        .from("provider_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabase.rpc("my_availability"),
    ]);

    if (resOfertas.error) setErro(resOfertas.error.message);
    else setOfertas((resOfertas.data as Oferta[]) ?? []);

    // count vem em resFotos.count, não em data
    if (resFotos.error) setErro(resFotos.error.message);
    else setFotos(resFotos.count ?? 0);

    if (!resDisp.error) setOnline(Boolean(resDisp.data));

    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarOnline() {
    const novo = !online;
    setSalvandoOnline(true);
    setErro(null);
    setAviso(null);

    // grava de verdade no banco (era isto que faltava)
    const { error } = await supabase.rpc("set_availability", { p_available: novo });

    if (error) {
      setErro(error.message);
    } else {
      setOnline(novo);
      setAviso(
        novo
          ? "Você está online. Clientes por perto podem te encontrar no radar."
          : "Você está offline. Suas ofertas continuam publicadas."
      );
      // confirma com o banco em vez de confiar no estado local
      const { data } = await supabase.rpc("my_availability");
      if (typeof data === "boolean") setOnline(data);
    }
    setSalvandoOnline(false);
  }

  async function alternarOferta(oferta: Oferta) {
    setErro(null);
    const { error } = await supabase.rpc("toggle_offer", {
      p_offer_id: oferta.offer_id,
      p_active: !oferta.ativa,
    });
    if (error) setErro(error.message);
    else carregar();
  }

  async function excluirOferta(oferta: Oferta) {
    if (!window.confirm("Excluir esta oferta? Ela sai da vitrine imediatamente.")) return;
    setErro(null);
    const { error } = await supabase.rpc("delete_offer", { p_offer_id: oferta.offer_id });
    if (error) setErro(error.message);
    else carregar();
  }

  const perfilIncompleto = fotos !== null && fotos < MIN_FOTOS;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Meu painel</h1>
          <p className="text-sm opacity-70">
            {fotos === null
              ? "Carregando perfil…"
              : `${fotos} foto${fotos === 1 ? "" : "s"} no perfil`}
          </p>
        </div>

        <button
          onClick={alternarOnline}
          disabled={salvandoOnline}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            online ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-200"
          } ${salvandoOnline ? "opacity-60" : ""}`}
        >
          {salvandoOnline ? "Salvando…" : online ? "● Online" : "○ Offline"}
        </button>
      </header>

      {/* mensagem real do banco, nunca genérica */}
      {erro && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {aviso}
        </div>
      )}

      {perfilIncompleto && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Perfil incompleto: {fotos}/{MIN_FOTOS} fotos. Adicione mais para publicar
          ofertas e enviar propostas.
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Minhas ofertas</h2>
          <button onClick={carregar} className="text-sm underline opacity-70">
            Atualizar
          </button>
        </div>

        {carregando && <p className="text-sm opacity-60">Carregando…</p>}

        {!carregando && ofertas.length === 0 && (
          <div className="rounded-lg border border-white/10 p-6 text-center text-sm opacity-70">
            Você ainda não publicou nenhuma oferta.
          </div>
        )}

        {ofertas.map((o) => (
          <article
            key={o.offer_id}
            className="rounded-xl border border-white/10 p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {o.service_type}
                  {o.sub_type ? ` · ${o.sub_type}` : ""}
                </p>
                <p className="text-sm opacity-70">
                  {o.local_option} ·{" "}
                  {new Date(o.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">
                  {o.price.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
                <span
                  className={`text-xs ${
                    o.ativa ? "text-emerald-400" : "text-zinc-400"
                  }`}
                >
                  {o.ativa ? "Publicada" : "Pausada"}
                </span>
              </div>
            </div>

            {o.flags && o.flags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {o.flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-xs opacity-80"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => alternarOferta(o)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm"
              >
                {o.ativa ? "Pausar" : "Publicar"}
              </button>
              <button
                onClick={() => excluirOferta(o)}
                className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300"
              >
                Excluir
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
