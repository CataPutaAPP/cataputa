import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types";

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface Profile {
  id: string;
  role: UserRole;
  status: string;
  full_name: string;
  username: string;
  cpf: string;
  phone: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  gender: string | null;
  date_of_birth: string | null;
  lat: number | null;
  lng: number | null;
  has_local: boolean;
  local_address: string | null;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface SignUpInput {
  full_name: string;
  cpf: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  role: UserRole;
  gender?: string;
  date_of_birth?: string;
}

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<{ error: string | null }>;
  signIn: (username: string, password: string) => Promise<{ error: string | null; role?: UserRole }>;
  signOut: () => void;
  isUsernameTaken: (username: string) => Promise<boolean>;
  requestPasswordReset: (username: string) => Promise<{ error: string | null }>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ─── Provider ──────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Small delay to let the trigger finish creating the profile
    await new Promise((r) => setTimeout(r, 500));

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) return null;
    return data as Profile;
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Sign up — profile is created automatically by database trigger
  const signUp = useCallback<AuthContextValue["signUp"]>(async (input) => {
    // 1. Username livre? (a função do banco responde só sim/não)
    const { data: livre } = await supabase.rpc("username_available", { p_username: input.username });
    if (livre === false) return { error: "Este username já está em uso." };

    // 2. CPF: NÃO consultamos. Uma consulta pública permitiria descobrir
    //    quem tem conta aqui. A duplicidade é barrada pelo banco, abaixo.

    // 3. Create auth user — trigger handles profile insert automatically
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.full_name,
          username: input.username,
          role: input.role,
          cpf: input.cpf,
          phone: input.phone,
          gender: input.gender ?? "",
          date_of_birth: input.date_of_birth ?? "",
        },
      },
    });

    if (authError) {
      const m = (authError.message || "").toLowerCase();
      if (m.includes("ux_profiles_cpf") || (m.includes("duplicate") && m.includes("cpf"))) {
        return { error: "Este CPF já está cadastrado. Se a conta é sua, use 'Esqueci minha senha'." };
      }
      if (m.includes("ux_profiles_username") || (m.includes("duplicate") && m.includes("username"))) {
        return { error: "Este username já está em uso." };
      }
      if (m.includes("already registered") || m.includes("already been registered")) {
        return { error: "Já existe conta com este e-mail. Use 'Esqueci minha senha'." };
      }
      return { error: authError.message };
    }
    if (!authData.user) return { error: "Erro ao criar usuário." };

    // 4. Sign out (user needs to login explicitly)
    await supabase.auth.signOut();

    return { error: null };
  }, []);

  // Sign in by username
  const signIn = useCallback<AuthContextValue["signIn"]>(async (username, password) => {
    const { data: emailData, error: rpcError } = await supabase.rpc(
      "get_email_by_username",
      { p_username: username },
    );

    if (rpcError || !emailData || emailData.length === 0) {
      return { error: "Username não encontrado." };
    }

    const email = emailData[0].email;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error: "Username ou senha inválidos." };

    const profile = await fetchProfile(data.user.id);
    if (profile) {
      setUser(profile);
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", data.user.id)
        .then();

      return { error: null, role: profile.role };
    }

    return { error: null, role: undefined };
  }, [fetchProfile]);

  const signOut = useCallback(() => {
    supabase.auth.signOut();
    setUser(null);
  }, []);

  const isUsernameTaken = useCallback(async (username: string): Promise<boolean> => {
    // consulta pelo banco (sem ler a tabela): responde só sim/não
    const { data, error } = await supabase.rpc("username_available", { p_username: username });
    if (error) return false;            // na dúvida, deixa seguir: o banco barra no fim
    return data === false;
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (username) => {
      const { data, error: rpcError } = await supabase.rpc(
        "get_email_by_username",
        { p_username: username },
      );

      if (rpcError || !data || data.length === 0) {
        return { error: "Username não encontrado." };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(data[0].email);
      if (error) return { error: error.message };
      return { error: null };
    },
    [],
  );

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ lat, lng, last_seen_at: new Date().toISOString() })
      .eq("id", user.id);
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      signUp,
      signIn,
      signOut,
      isUsernameTaken,
      requestPasswordReset,
      updateLocation,
    }),
    [user, loading, signUp, signIn, signOut, isUsernameTaken, requestPasswordReset, updateLocation],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ─── Hook ──────────────────────────────────────────────────────────── */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const dashboardPath: Record<UserRole, "/cliente" | "/prestador" | "/parceiro"> = {
  cliente: "/cliente",
  prestador: "/prestador",
  parceiro: "/parceiro",
};
