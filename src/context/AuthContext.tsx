import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User, UserRole } from "@/types";

const USERS_KEY = "sv_users";
const SESSION_KEY = "sv_session";

export interface SignUpInput {
  full_name: string;
  cpf: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  role: UserRole;
}

interface StoredUser extends User {
  password: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<{ error: string | null }>;
  signIn: (username: string, password: string) => Promise<{ error: string | null; role?: UserRole }>;
  signOut: () => void;
  isUsernameTaken: (username: string) => boolean;
  requestPasswordReset: (username: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as StoredUser[];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem(SESSION_KEY);
    if (id) {
      const found = readUsers().find((u) => u.id === id);
      if (found) {
        const { password: _pw, ...safe } = found;
        setUser(safe);
      }
    }
    setLoading(false);
  }, []);

  const isUsernameTaken = useCallback(
    (username: string) =>
      readUsers().some((u) => u.username.toLowerCase() === username.trim().toLowerCase()),
    [],
  );

  const signUp = useCallback<AuthContextValue["signUp"]>(async (input) => {
    const users = readUsers();
    if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase()))
      return { error: "Este username já está em uso." };
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase()))
      return { error: "Este e-mail já está cadastrado." };

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      full_name: input.full_name,
      cpf: input.cpf,
      phone: input.phone,
      email: input.email,
      username: input.username,
      role: input.role,
      password: input.password,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    writeUsers([...users, newUser]);
    return { error: null };
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (username, password) => {
    const found = readUsers().find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
    );
    if (!found || found.password !== password)
      return { error: "Username ou senha inválidos." };
    const { password: _pw, ...safe } = found;
    localStorage.setItem(SESSION_KEY, safe.id);
    setUser(safe);
    return { error: null, role: safe.role };
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (username) => {
      const found = readUsers().find(
        (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
      );
      if (!found) return { error: "Não encontramos esse username." };
      return { error: null };
    },
    [],
  );

  const value = useMemo(
    () => ({ user, loading, signUp, signIn, signOut, isUsernameTaken, requestPasswordReset }),
    [user, loading, signUp, signIn, signOut, isUsernameTaken, requestPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

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
