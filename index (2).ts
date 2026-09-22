// CataPuta — verification-start
// Cria uma sessão de verificação na Didit para o usuário logado e devolve a URL.
// Secrets: DIDIT_API_KEY, DIDIT_WORKFLOW_IDADE, DIDIT_WORKFLOW_DOCUMENTO, APP_URL
// "Verify JWT" LIGADO (padrão).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_SESSIONS_PER_DAY = 5; // evita custo com tentativas em loop

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth?.user) return json({ error: "Faça login novamente." }, 401);
  const userId = auth.user.id;

  let body: { kind?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  const [{ data: profile }, { data: status }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).single(),
    admin.from("user_verification").select("verification_status, is_suspended").eq("user_id", userId).maybeSingle(),
  ]);
  if (!profile) return json({ error: "Perfil não encontrado." }, 404);
  if (status?.is_suspended) return json({ error: "Conta suspensa. Fale com o suporte." }, 403);
  if (status?.verification_status === "aprovado") return json({ already: true });

  // Cliente começa pela selfie; prestador e parceiro sempre com documento
  const role = String(profile.role);
  const kind = role === "cliente" && body.kind !== "documento" ? "idade" : "documento";
  const workflowId = Deno.env.get(kind === "idade" ? "DIDIT_WORKFLOW_IDADE" : "DIDIT_WORKFLOW_DOCUMENTO");
  if (!workflowId) return json({ error: "Verificação ainda não configurada." }, 503);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("verification_sessions")
    .select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= MAX_SESSIONS_PER_DAY) {
    return json({ error: "Muitas tentativas hoje. Tente novamente amanhã ou fale com o suporte." }, 429);
  }

  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  const res = await fetch("https://verification.didit.me/v3/session/", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("DIDIT_API_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: userId,
      callback: `${appUrl}/${role}?verificacao=retorno`,
      callback_method: "both",
      metadata: { kind, role },
    }),
  });
  if (!res.ok) {
    console.error("didit create session", res.status, await res.text());
    return json({ error: "Serviço de verificação indisponível. Tente em instantes." }, 502);
  }
  const session = await res.json();

  const { error: insErr } = await admin.from("verification_sessions").insert({
    user_id: userId, kind, session_id: session.session_id, provider_status: session.status ?? "Not Started",
  });
  if (insErr) console.error("insert verification_sessions", insErr);
  await admin.from("user_verification").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  return json({ url: session.url, kind });
});
