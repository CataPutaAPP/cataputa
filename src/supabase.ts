import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xnlilijaxevnlueekwzw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubGlsaWpheGV2bmx1ZWVrd3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Mjg0MDcsImV4cCI6MjEwNDEwNDQwN30.4Xqc2bQ-bkuI_fCS-PhnaYy4vrpDyOMn1snWCgjUHbQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Canais de tempo real com nome SEMPRE único.
 * Versões novas do supabase-js devolvem o mesmo canal quando o nome se repete; se duas
 * telas pedem "unread-<id>" ao mesmo tempo, a segunda derruba a página inteira
 * ("cannot add callbacks after subscribe"). Aqui todo supabase.channel() do app
 * ganha um sufixo, então nenhuma tela precisa se preocupar com isso.
 */
let seqCanal = 0;
const canalOriginal = supabase.channel.bind(supabase);
supabase.channel = ((nome: string, opcoes?: Parameters<typeof canalOriginal>[1]) => {
  seqCanal += 1;
  return canalOriginal(`${nome}:${seqCanal}`, opcoes);
}) as typeof supabase.channel;

export const canal = (nome: string) => supabase.channel(nome);
