// CataPuta — verify-cnpj
// Valida o CNPJ do parceiro (dígitos + situação ATIVA na Receita via BrasilAPI, grátis).
// Sem secrets extras. "Verify JWT" LIGADO (padrão).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export function isValidCnpj(input: string): boolean {
  const c = (input ?? "").replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = w.reduce((s, wi, i) => s + Number(c[i]) * wi, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json({ error: "Faça login novamente." }, 401);
  const userId = auth.user.id;

  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (String(profile?.role) !== "parceiro") return json({ error: "Apenas parceiros." }, 403);

  const { cnpj } = await req.json().catch(() => ({ cnpj: "" }));
  const digits = String(cnpj ?? "").replace(/\D/g, "");
  if (!isValidCnpj(digits)) return json({ error: "CNPJ inválido. Confira os números." }, 400);

  const { data: dup } = await admin.from("user_verification").select("user_id")
    .eq("cnpj", digits).neq("user_id", userId).maybeSingle();
  if (dup) return json({ error: "Este CNPJ já está cadastrado em outra conta." }, 409);

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (res.status === 404) return json({ error: "CNPJ não encontrado na Receita Federal." }, 400);
  if (!res.ok) return json({ error: "Consulta à Receita indisponível. Tente em instantes." }, 502);
  const data = await res.json();
  const situacao = String(data.descricao_situacao_cadastral ?? "").toUpperCase();
  if (situacao !== "ATIVA") return json({ error: `CNPJ com situação "${situacao || "desconhecida"}". É preciso estar ATIVO.` }, 400);

  const legalName = data.razao_social ?? null;
  const { error } = await admin.from("user_verification").upsert({
    user_id: userId, cnpj: digits, cnpj_legal_name: legalName,
    cnpj_verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return json({ error: "Erro ao salvar." }, 500);
  return json({ ok: true, legal_name: legalName, nome_fantasia: data.nome_fantasia ?? null });
});
