import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xnlilijaxevnlueekwzw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubGlsaWpheGV2bmx1ZWVrd3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Mjg0MDcsImV4cCI6MjEwNDEwNDQwN30.4Xqc2bQ-bkuI_fCS-PhnaYy4vrpDyOMn1snWCgjUHbQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
