// CataPuta — didit-webhook
// Recebe o aviso da Didit, confere a assinatura, BUSCA a decisão direto na Didit
// (não confia no conteúdo recebido) e aplica a regra dos 18 anos do nosso lado.
// Secrets: DIDIT_API_KEY, DIDIT_WEBHOOK_SECRET
// "Verify JWT" DESLIGADO (a Didit não envia token do Supabase).
import { createClient } from "npm:@supabase/supabase-js@2";

// DECIDE-START ─────────────────────────────────────────────────────────
export type Result = "pendente" | "em_analise" | "documento_necessario" | "aprovado" | "reprovado";
export interface Decision {
  result: Result;
  method?: "estimativa_idade" | "documento";
  estimatedAge?: number | null;
  documentAge?: number | null;
  reason?: string;
  suspend?: boolean;
}

export function ageFromDob(dob: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getUTCFullYear() - y;
  const md = (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  if (md < mo * 100 + d) age -= 1;
  return age;
}

// deno-lint-ignore no-explicit-any
export function decide(kind: "idade" | "documento", decision: any, minEstimatedAge: number, now = new Date()): Decision {
  const st = String(decision?.status ?? "");
  if (["Not Started", "In Progress", "Abandoned", "Expired"].includes(st)) return { result: "pendente" };
  if (["In Review", "Awaiting User", "Resubmitted"].includes(st)) return { result: "em_analise" };
  if (st === "Kyc Expired") return { result: "reprovado", reason: "Documento vencido. Verifique novamente com um documento válido." };
  if (st === "Declined") {
    return { result: "reprovado", reason: "Não foi possível confirmar. Tente de novo com boa iluminação e documento válido." };
  }
  if (st !== "Approved") return { result: "em_analise" };

  // Documento: a regra dos 18 anos é NOSSA — um menor com RG válido seria "Approved" na Didit
  const dobs: string[] = (decision.id_verifications ?? [])
    .map((v: { date_of_birth?: string }) => v?.date_of_birth).filter(Boolean);
  const docAges = dobs.map((d) => ageFromDob(d, now)).filter((a): a is number => a !== null);
  if (docAges.length) {
    const docAge = Math.min(...docAges);
    if (docAge >= 18) return { result: "aprovado", method: "documento", documentAge: docAge };
    return { result: "reprovado", method: "documento", documentAge: docAge, suspend: true,
             reason: "O documento indica menor de 18 anos. O uso do CataPuta é proibido para menores." };
  }
  if (kind === "documento") {
    return { result: "reprovado", reason: "Não conseguimos ler a data de nascimento do documento. Tente novamente." };
  }

  // Selfie: estimativa é triagem, não prova — abaixo do mínimo pede documento
  const ests: number[] = (decision.liveness_checks ?? [])
    .map((l: { age_estimation?: number | null }) => l?.age_estimation)
    .filter((a: unknown): a is number => typeof a === "number");
  if (!ests.length) return { result: "documento_necessario", reason: "Não foi possível estimar a idade pela selfie." };
  const est = Math.min(...ests);
  if (est >= minEstimatedAge) return { result: "aprovado", method: "estimativa_idade", estimatedAge: est };
  return { result: "documento_necessario", estimatedAge: est,
           reason: "Para sua segurança, precisamos confirmar sua idade com um documento." };
}
// DECIDE-END ───────────────────────────────────────────────────────────

async function hmacHex(secret: string, data: string | Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const sig = await crypto.subtle.sign("HMAC", key, bytes);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignature(raw: Uint8Array, headers: Headers, secret: string): Promise<boolean> {
  const ts = Number(headers.get("x-timestamp"));
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;          // anti-replay: 5 min
  const sigRaw = headers.get("x-signature");
  if (sigRaw && safeEqual(await hmacHex(secret, raw), sigRaw)) return true; // corpo bruto (mais forte)
  const sigSimple = headers.get("x-signature-simple");
  if (sigSimple) {
    const b = JSON.parse(new TextDecoder().decode(raw));
    const canonical = [b.timestamp ?? "", b.session_id ?? "", b.status ?? "", b.webhook_type ?? ""].join(":");
    if (safeEqual(await hmacHex(secret, canonical), sigSimple)) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = new Uint8Array(await req.arrayBuffer());
  if (!(await verifySignature(raw, req.headers, Deno.env.get("DIDIT_WEBHOOK_SECRET")!))) {
    return new Response("assinatura inválida", { status: 401 });
  }
  const payload = JSON.parse(new TextDecoder().decode(raw));
  const sessionId: string | undefined = payload.session_id;
  if (!sessionId) return new Response("ok");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: vs } = await admin.from("verification_sessions")
    .select("id, user_id, kind, created_at").eq("session_id", sessionId).maybeSingle();
  if (!vs) return new Response("sessão desconhecida", { status: 200 }); // não foi criada por nós

  // Fonte da verdade: a decisão buscada direto na Didit
  const res = await fetch(`https://verification.didit.me/v3/session/${sessionId}/decision/`, {
    headers: { "x-api-key": Deno.env.get("DIDIT_API_KEY")! },
  });
  if (!res.ok) {
    console.error("didit decision", res.status, await res.text());
    return new Response("erro ao buscar decisão", { status: 502 }); // a Didit reenvia
  }
  const decision = await res.json();

  const { data: setting } = await admin.from("platform_settings")
    .select("value").eq("key", "verification_min_estimated_age").maybeSingle();
  const d = decide(vs.kind, decision, Number(setting?.value ?? 25));

  await admin.from("verification_sessions").update({
    provider_status: decision.status, result: d.result, updated_at: new Date().toISOString(),
    summary: { estimated_age: d.estimatedAge ?? null, document_age: d.documentAge ?? null, reason: d.reason ?? null },
  }).eq("id", vs.id);

  // Só a sessão MAIS RECENTE muda o status (aviso atrasado de sessão antiga não desfaz aprovação)
  const { data: latest } = await admin.from("verification_sessions")
    .select("id").eq("user_id", vs.user_id).order("created_at", { ascending: false }).limit(1).single();
  if (latest?.id !== vs.id) return new Response("ok (sessão antiga)");

  const patch: Record<string, unknown> = {
    user_id: vs.user_id,
    verification_status: d.result,
    reject_reason: d.result === "reprovado" || d.result === "documento_necessario" ? d.reason ?? null : null,
    updated_at: new Date().toISOString(),
  };
  if (d.result === "aprovado") {
    patch.verification_method = d.method;
    patch.estimated_age = d.estimatedAge ?? null;
    patch.verified_at = new Date().toISOString();
  }
  if (d.suspend) {
    patch.is_suspended = true;
    patch.suspended_reason = "Documento indica menor de 18 anos";
    patch.suspended_at = new Date().toISOString();
  }
  const { error } = await admin.from("user_verification").upsert(patch, { onConflict: "user_id" });
  if (error) { console.error("user_verification", error); return new Response("erro", { status: 500 }); }
  return new Response("ok");
});
