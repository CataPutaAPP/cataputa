import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xnlilijaxevnlueekwzw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubGlsaWpheGV2bmx1ZWVrd3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Mjg0MDcsImV4cCI6MjEwNDEwNDQwN30.4Xqc2bQ-bkuI_fCS-PhnaYy4vrpDyOMn1snWCgjUHbQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Canal de tempo real com nome único.
 * Versões novas do supabase-js devolvem o MESMO canal quando o nome se repete; se duas
 * telas pedem "unread-<id>" ao mesmo tempo, a segunda quebra a página inteira
 * ("cannot add callbacks after subscribe"). Use sempre canal() em vez de supabase.channel().
 */
let seqCanal = 0;
export function canal(nome: string) {
  seqCanal += 1;
  return supabase.channel(`${nome}:${seqCanal}`);
}
