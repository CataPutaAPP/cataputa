import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Briefcase, CheckCircle2, Handshake, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { MapBackground } from "@/components/MapBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";
import { isValidCPF, isValidEmail, isValidPhone, maskCPF, maskPhone } from "@/lib/masks";
import { genderOptions } from "@/lib/service-options";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — CataPuta Web" },
      {
        name: "description",
        content: "Escolha seu perfil e crie sua conta no CataPuta Web.",
      },
    ],
  }),
  component: Cadastro,
});

const roles: { role: UserRole; title: string; desc: string; Icon: typeof UserIcon }[] = [
  { role: "cliente", title: "Cliente", desc: "Solicite serviços quando precisar", Icon: UserIcon },
  { role: "prestador", title: "Prestador", desc: "Receba ofertas e execute serviços", Icon: Briefcase },
  { role: "parceiro", title: "Parceiro", desc: "Participe de negociações em conjunto", Icon: Handshake },
];

const roleLabel: Record<UserRole, string> = {
  cliente: "Cliente",
  prestador: "Prestador",
  parceiro: "Parceiro",
};

type FormErrors = {
  full_name?: string;
  cpf?: string;
  phone?: string;
  email?: string;
  username?: string;
  password?: string;
  confirm?: string;
  gender?: string;
  date_of_birth?: string;
};

function Cadastro() {
  const navigate = useNavigate();
  const { signUp, isUsernameTaken } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirm: "",
    gender: "",
    date_of_birth: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function validate(): Promise<boolean> {
    const e: FormErrors = {};
    if (form.full_name.trim().split(" ").length < 2) e.full_name = "Informe nome e sobrenome.";
    if (!isValidCPF(form.cpf)) e.cpf = "CPF inválido.";
    if (!isValidPhone(form.phone)) e.phone = "Telefone incompleto.";
    if (!isValidEmail(form.email)) e.email = "E-mail inválido.";
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(form.username))
      e.username = "Use 3 a 20 caracteres (letras, números, _ ou .).";
    else if (await isUsernameTaken(form.username)) e.username = "Este username já está em uso.";
    if (form.password.length < 6) e.password = "Mínimo de 6 caracteres.";
    if (form.password !== form.confirm) e.confirm = "As senhas não coincidem.";

    if (form.date_of_birth) {
      const birth = new Date(form.date_of_birth);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      const realAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;
      if (realAge < 18) e.date_of_birth = "Você precisa ter 18 anos ou mais.";
    } else {
      e.date_of_birth = "Informe sua data de nascimento.";
    }

    if (role === "prestador" && !form.gender) {
      e.gender = "Selecione como você aparecerá no marketplace.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!role) return;

    setSubmitting(true);
    const valid = await validate();
    if (!valid) {
      setSubmitting(false);
      return;
    }

    const { error } = await signUp({
      ...form,
      role,
      gender: form.gender || undefined,
      date_of_birth: form.date_of_birth || undefined,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setStep(3);
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-8">
      <MapBackground className="opacity-60" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Button asChild variant="ghost" size="icon">
            <Link to="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <Logo size="sm" />
          <span className="w-9" />
        </div>

        {step !== 3 && (
          <div className="mb-6 flex items-center gap-2">
            {[1, 2].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-semibold">Escolha seu perfil</h1>
            <p className="text-sm text-muted-foreground">
              Você poderá usar recursos diferentes conforme o perfil escolhido.
            </p>
            <div className="space-y-3 pt-2">
              {roles.map(({ role: r, title, desc, Icon }) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`panel flex w-full items-center gap-4 p-4 text-left transition-all ${
                    role === r ? "ring-2 ring-primary shadow-glow" : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-muted-foreground">{desc}</span>
                  </span>
                  {role === r && <CheckCircle2 className="ml-auto size-5 text-primary" />}
                </button>
              ))}
            </div>
            <Button className="h-12 w-full" disabled={!role} onClick={() => setStep(2)}>
              Continuar
            </Button>
          </section>
        )}

        {step === 2 && role && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Seus dados</h1>
              <Badge className="bg-accent text-accent-foreground">{roleLabel[role]}</Badge>
            </div>

            <Field label="Nome completo" htmlFor="full_name" error={errors.full_name}>
              <Input id="full_name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Maria Silva" />
            </Field>
            <Field label="CPF" htmlFor="cpf" error={errors.cpf}>
              <Input id="cpf" value={form.cpf} inputMode="numeric" onChange={(e) => set("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" />
            </Field>
            <Field label="Telefone" htmlFor="phone" error={errors.phone}>
              <Input id="phone" value={form.phone} inputMode="tel" onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="+55 (11) 90000-0000" />
            </Field>
            <Field label="E-mail" htmlFor="email" error={errors.email}>
              <Input id="email" value={form.email} type="email" onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" />
            </Field>
            <Field label="Data de nascimento" htmlFor="date_of_birth" error={errors.date_of_birth}>
              <Input id="date_of_birth" value={form.date_of_birth} type="date" onChange={(e) => set("date_of_birth", e.target.value)} />
            </Field>
            <Field label="Username" htmlFor="username" error={errors.username}>
              <Input id="username" value={form.username} onChange={(e) => set("username", e.target.value.trim())} placeholder="mariasilva" autoCapitalize="none" />
            </Field>
            <Field label="Senha" htmlFor="password" error={errors.password}>
              <Input id="password" value={form.password} type="password" onChange={(e) => set("password", e.target.value)} />
            </Field>
            <Field label="Confirmar senha" htmlFor="confirm" error={errors.confirm}>
              <Input id="confirm" value={form.confirm} type="password" onChange={(e) => set("confirm", e.target.value)} />
            </Field>

            <Field
              label={role === "prestador" ? "Como você aparece no marketplace" : "Gênero (opcional)"}
              htmlFor="gender"
              error={errors.gender}
            >
              <div className="flex flex-wrap gap-2">
                {genderOptions.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => set("gender", form.gender === g.value ? "" : g.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      form.gender === g.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button type="submit" className="h-12 flex-1" disabled={submitting}>
                {submitting ? "Criando..." : "Finalizar"}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <section className="panel space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto size-14 text-success" />
            <h1 className="text-xl font-semibold">Cadastro realizado!</h1>
            <p className="text-sm text-muted-foreground">
              Sua conta foi criada com sucesso.
            </p>
            <Button className="h-12 w-full" onClick={() => navigate({ to: "/login" })}>
              Ir para o login
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
