import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Tradução do app.
 *  - useT() devolve t("chave") no idioma escolhido; falta de tradução cai no português.
 *  - <LanguageSwitcher /> mostra as bandeiras e troca o idioma (fica salvo no aparelho).
 * Para traduzir uma tela nova: troque o texto fixo por t("tela.item") e acrescente
 * a chave nos 5 dicionários abaixo.
 */
export const IDIOMAS = [
  { code: "pt", nome: "Português" },
  { code: "en", nome: "English" },
  { code: "es", nome: "Español" },
  { code: "fr", nome: "Français" },
  { code: "ru", nome: "Русский" },
] as const;
export type Idioma = (typeof IDIOMAS)[number]["code"];

const pt = {
  "logo.sub": "Acesso reservado. Discrição em primeiro lugar.",
  "landing.tagline": "Um clube reservado para maiores de 18 anos. Perfis verificados, conversa protegida e total discrição.",
  "landing.cta": "Solicitar acesso",
  "landing.member": "Já sou membro",
  "landing.legal": "Ao continuar você declara ter 18 anos ou mais e aceita os",
  "landing.terms": "termos de uso",
  "landing.and": "e a",
  "landing.privacy": "política de privacidade",
  "login.title": "Entrar",
  "login.username": "Username",
  "login.username.ph": "seu.username",
  "login.password": "Senha",
  "login.submit": "Entrar",
  "login.forgot": "Esqueci minha senha",
  "login.noaccount": "Ainda não tem conta?",
  "login.signup": "Cadastre-se",
  "login.fail": "Não foi possível entrar.",
  "login.welcome": "Bem-vindo de volta!",
  "login.needuser": "Informe seu username primeiro.",
  "login.resetsent": "Enviamos um link de redefinição para o e-mail cadastrado.",
  "stats.online": "online agora",
  "stats.now": "encontros agora",
  "stats.rooms": "quartos reservados",
  "stats.members": "membros",
  "stats.done": "encontros realizados",
  "stats.bookings": "reservas de quarto",
  "lang.title": "Idioma",
};
type Chave = keyof typeof pt;

const dic: Record<Idioma, Partial<Record<Chave, string>>> = {
  pt,
  en: {
    "logo.sub": "Members only. Discretion first.",
    "landing.tagline": "A private club for adults aged 18 and over. Verified profiles, protected chat and complete discretion.",
    "landing.cta": "Request access",
    "landing.member": "I'm already a member",
    "landing.legal": "By continuing you confirm you are 18 or older and accept the",
    "landing.terms": "terms of use",
    "landing.and": "and the",
    "landing.privacy": "privacy policy",
    "login.title": "Sign in",
    "login.username": "Username",
    "login.username.ph": "your.username",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.forgot": "I forgot my password",
    "login.noaccount": "Don't have an account yet?",
    "login.signup": "Sign up",
    "login.fail": "Could not sign in.",
    "login.welcome": "Welcome back!",
    "login.needuser": "Enter your username first.",
    "login.resetsent": "We sent a reset link to your registered email.",
    "stats.online": "online now",
    "stats.now": "meetings now",
    "stats.rooms": "rooms booked",
    "stats.members": "members",
    "stats.done": "meetings held",
    "stats.bookings": "room bookings",
    "lang.title": "Language",
  },
  es: {
    "logo.sub": "Acceso reservado. La discreción es lo primero.",
    "landing.tagline": "Un club reservado para mayores de 18 años. Perfiles verificados, chat protegido y total discreción.",
    "landing.cta": "Solicitar acceso",
    "landing.member": "Ya soy miembro",
    "landing.legal": "Al continuar declaras tener 18 años o más y aceptas los",
    "landing.terms": "términos de uso",
    "landing.and": "y la",
    "landing.privacy": "política de privacidad",
    "login.title": "Entrar",
    "login.username": "Usuario",
    "login.username.ph": "tu.usuario",
    "login.password": "Contraseña",
    "login.submit": "Entrar",
    "login.forgot": "Olvidé mi contraseña",
    "login.noaccount": "¿Aún no tienes cuenta?",
    "login.signup": "Regístrate",
    "login.fail": "No fue posible entrar.",
    "login.welcome": "¡Bienvenido de nuevo!",
    "login.needuser": "Escribe primero tu usuario.",
    "login.resetsent": "Enviamos un enlace de restablecimiento a tu correo registrado.",
    "stats.online": "en línea ahora",
    "stats.now": "encuentros ahora",
    "stats.rooms": "habitaciones reservadas",
    "stats.members": "miembros",
    "stats.done": "encuentros realizados",
    "stats.bookings": "reservas de habitación",
    "lang.title": "Idioma",
  },
  fr: {
    "logo.sub": "Accès réservé. La discrétion avant tout.",
    "landing.tagline": "Un club réservé aux personnes de 18 ans et plus. Profils vérifiés, messagerie protégée et discrétion totale.",
    "landing.cta": "Demander l'accès",
    "landing.member": "Je suis déjà membre",
    "landing.legal": "En continuant, vous déclarez avoir 18 ans ou plus et acceptez les",
    "landing.terms": "conditions d'utilisation",
    "landing.and": "et la",
    "landing.privacy": "politique de confidentialité",
    "login.title": "Connexion",
    "login.username": "Identifiant",
    "login.username.ph": "votre.identifiant",
    "login.password": "Mot de passe",
    "login.submit": "Se connecter",
    "login.forgot": "Mot de passe oublié",
    "login.noaccount": "Pas encore de compte ?",
    "login.signup": "Inscrivez-vous",
    "login.fail": "Connexion impossible.",
    "login.welcome": "Bon retour !",
    "login.needuser": "Saisissez d'abord votre identifiant.",
    "login.resetsent": "Nous avons envoyé un lien de réinitialisation à votre e-mail.",
    "stats.online": "en ligne",
    "stats.now": "rencontres en cours",
    "stats.rooms": "chambres réservées",
    "stats.members": "membres",
    "stats.done": "rencontres réalisées",
    "stats.bookings": "réservations de chambre",
    "lang.title": "Langue",
  },
  ru: {
    "logo.sub": "Закрытый доступ. Конфиденциальность прежде всего.",
    "landing.tagline": "Закрытый клуб для лиц старше 18 лет. Проверенные профили, защищённый чат и полная конфиденциальность.",
    "landing.cta": "Запросить доступ",
    "landing.member": "Я уже участник",
    "landing.legal": "Продолжая, вы подтверждаете, что вам есть 18 лет, и принимаете",
    "landing.terms": "условия использования",
    "landing.and": "и",
    "landing.privacy": "политику конфиденциальности",
    "login.title": "Вход",
    "login.username": "Имя пользователя",
    "login.username.ph": "ваше.имя",
    "login.password": "Пароль",
    "login.submit": "Войти",
    "login.forgot": "Я забыл пароль",
    "login.noaccount": "Ещё нет аккаунта?",
    "login.signup": "Зарегистрируйтесь",
    "login.fail": "Не удалось войти.",
    "login.welcome": "С возвращением!",
    "login.needuser": "Сначала введите имя пользователя.",
    "login.resetsent": "Мы отправили ссылку для сброса на вашу почту.",
    "stats.online": "сейчас онлайн",
    "stats.now": "встреч сейчас",
    "stats.rooms": "номеров забронировано",
    "stats.members": "участников",
    "stats.done": "встреч состоялось",
    "stats.bookings": "бронирований номеров",
    "lang.title": "Язык",
  },
};

/* ── estado do idioma (um só para o app inteiro) ── */
let atual: Idioma = "pt";
const ouvintes = new Set<() => void>();
const CHAVE = "privora.idioma";

export function setIdioma(l: Idioma) {
  atual = l;
  try { localStorage.setItem(CHAVE, l); } catch { /* aparelho sem armazenamento: vale só nesta visita */ }
  if (typeof document !== "undefined") document.documentElement.lang = l === "pt" ? "pt-BR" : l;
  ouvintes.forEach((f) => f());
}

/** Idioma em uso agora (para código que não é tela). */
export function idiomaAtual(): Idioma { return atual; }

/** Avisa quando o idioma muda. Devolve a função que cancela o aviso. */
export function aoMudarIdioma(f: () => void): () => void {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

/** Idioma salvo no aparelho; senão, o idioma do navegador; senão, português. */
function detectar(): Idioma {
  const validos = IDIOMAS.map((i) => i.code) as readonly string[];
  try { const s = localStorage.getItem(CHAVE); if (s && validos.includes(s)) return s as Idioma; } catch { /* segue */ }
  const nav = typeof navigator !== "undefined" ? navigator.language.slice(0, 2).toLowerCase() : "pt";
  return (validos.includes(nav) ? nav : "pt") as Idioma;
}

/** Aplica o idioma salvo no aparelho (para telas que não usam useT, como termos e páginas de erro). */
export function aplicarIdiomaSalvo() {
  if (typeof window === "undefined") return;
  const d = detectar(); if (d !== atual) setIdioma(d);
}

export function useT() {
  const lang = useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => atual,
    () => "pt" as Idioma, // no servidor sempre português; o aparelho ajusta depois de carregar
  );
  // aplica o idioma do aparelho uma vez, depois que a página carregou
  useEffect(() => { const d = detectar(); if (d !== atual) setIdioma(d); }, []);
  const t = (k: Chave) => dic[lang][k] ?? pt[k];
  return { t, lang };
}

/* ── bandeiras desenhadas (emoji de bandeira não aparece no Windows) ── */
function Bandeira({ code }: { code: Idioma }) {
  const base = "h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/20";
  if (code === "pt") return (
    <svg viewBox="0 0 20 14" className={base}><rect width="20" height="14" fill="#009739" /><path d="M10 1.6 18 7l-8 5.4L2 7z" fill="#FEDD00" /><circle cx="10" cy="7" r="3" fill="#012169" /></svg>
  );
  if (code === "en") return (
    <svg viewBox="0 0 20 14" className={base}><rect width="20" height="14" fill="#fff" />{[0, 2, 4, 6, 8, 10, 12].map((y) => <rect key={y} y={y} width="20" height="1.08" fill="#B22234" />)}<rect width="9" height="7.5" fill="#3C3B6E" /></svg>
  );
  if (code === "es") return (
    <svg viewBox="0 0 20 14" className={base}><rect width="20" height="14" fill="#AA151B" /><rect y="3.5" width="20" height="7" fill="#F1BF00" /></svg>
  );
  if (code === "fr") return (
    <svg viewBox="0 0 20 14" className={base}><rect width="20" height="14" fill="#fff" /><rect width="6.67" height="14" fill="#0055A4" /><rect x="13.33" width="6.67" height="14" fill="#EF4135" /></svg>
  );
  return (
    <svg viewBox="0 0 20 14" className={base}><rect width="20" height="14" fill="#fff" /><rect y="4.67" width="20" height="4.67" fill="#0039A6" /><rect y="9.33" width="20" height="4.67" fill="#D52B1E" /></svg>
  );
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, t } = useT();
  const [aberto, setAberto] = useState(false);
  return (
    <div className={`notranslate relative ${className}`}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-label={t("lang.title")} aria-expanded={aberto}
        className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 text-xs font-semibold uppercase backdrop-blur-md hover:bg-secondary">
        <Bandeira code={lang} /> <span className="hidden sm:inline">{lang}</span>
      </button>
      {aberto && (
        <ul className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-2xl">
          {IDIOMAS.map((i) => (
            <li key={i.code}>
              <button type="button" onClick={() => { setIdioma(i.code); setAberto(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-secondary ${i.code === lang ? "font-semibold text-primary" : ""}`}>
                <Bandeira code={i.code} /> {i.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
