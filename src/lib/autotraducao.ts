import { LINHAS, MODELOS } from "@/lib/autotraducao-dic";
import { idiomaAtual, aoMudarIdioma } from "@/lib/i18n";

/**
 * Tradução automática das telas.
 *
 * As telas são escritas em português. Aqui, depois que a tela aparece, cada texto que
 * existe no dicionário é trocado pelo texto no idioma escolhido na bandeira — e volta
 * ao português quando o usuário escolhe português de novo.
 *
 * Vale para textos, avisos que aparecem no topo, dicas de campo (placeholder) e rótulos.
 * Não mexe no que o usuário digita nem em conteúdo marcado com a classe "notranslate".
 */
type Lang = "pt" | "en" | "es" | "fr" | "ru";
const COL: Record<Lang, number> = { pt: 0, en: 1, es: 2, fr: 1, ru: 1 };   // fr e ru usam o inglês por enquanto

const limpa = (s: string) => s.replace(/\s+/g, " ").trim();

const DIC = new Map<string, string[]>();
for (const linha of LINHAS.split("\n")) {
  const p = linha.split("|");
  if (p.length < 3 || !p[0]) continue;
  DIC.set(limpa(p[0]), p.map((x) => x.trim()));
}

function traduz(original: string, lang: Lang): string | null {
  if (lang === "pt") return null;
  const chave = limpa(original);
  if (!chave) return null;
  const col = COL[lang];
  const achado = DIC.get(chave);
  let novo: string | undefined = achado?.[col];
  if (!novo) {
    for (const [re, en, es] of MODELOS) {
      if (re.test(chave)) { novo = chave.replace(re, col === 2 ? es : en); break; }
    }
  }
  if (!novo || novo === chave) return null;
  // mantém os espaços que havia antes e depois do texto
  const ini = original.match(/^\s*/)?.[0] ?? "";
  const fim = original.match(/\s*$/)?.[0] ?? "";
  return ini + novo + fim;
}

interface Reg { o: string; t: string }
const textos = new WeakMap<Node, Reg>();
const atributos = new WeakMap<Element, Record<string, Reg>>();
const ATRIBUTOS = ["placeholder", "title", "aria-label"];
const PULAR = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "CODE"]);

function ignorado(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (PULAR.has(e.tagName) || e.classList.contains("notranslate") || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function acertaTexto(no: Node, lang: Lang) {
  const valor = no.nodeValue ?? "";
  let r = textos.get(no);
  // texto novo (ou a tela mudou o texto): o que está ali agora é o original em português
  if (!r || (valor !== r.t && valor !== r.o)) { r = { o: valor, t: valor }; textos.set(no, r); }
  const alvo = traduz(r.o, lang) ?? r.o;
  r.t = alvo;
  if (valor !== alvo) no.nodeValue = alvo;
}

function acertaAtributos(el: Element, lang: Lang) {
  let regs = atributos.get(el);
  for (const a of ATRIBUTOS) {
    const valor = el.getAttribute(a);
    if (valor == null) continue;
    if (!regs) { regs = {}; atributos.set(el, regs); }
    let r = regs[a];
    if (!r || (valor !== r.t && valor !== r.o)) { r = { o: valor, t: valor }; regs[a] = r; }
    const alvo = traduz(r.o, lang) ?? r.o;
    r.t = alvo;
    if (valor !== alvo) el.setAttribute(a, alvo);
  }
}

function varre(raiz: Node, lang: Lang) {
  if (raiz.nodeType === Node.TEXT_NODE) {
    if (!ignorado(raiz.parentElement)) acertaTexto(raiz, lang);
    return;
  }
  if (raiz.nodeType !== Node.ELEMENT_NODE) return;
  const el = raiz as Element;
  if (ignorado(el)) return;
  acertaAtributos(el, lang);
  const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = andar.nextNode(); n; n = andar.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) { if (!ignorado(n.parentElement)) acertaTexto(n, lang); }
    else acertaAtributos(n as Element, lang);
  }
}

let ligado = false;

/** Liga a tradução automática. Chamar uma vez, quando o app abre. */
export function iniciarAutoTraducao() {
  if (ligado || typeof window === "undefined" || typeof MutationObserver === "undefined") return;
  ligado = true;
  const lang = () => idiomaAtual() as Lang;

  const observador = new MutationObserver((mudancas) => {
    const l = lang();
    for (const m of mudancas) {
      if (m.type === "characterData") {
        if (!ignorado(m.target.parentElement)) acertaTexto(m.target, l);
      } else if (m.type === "attributes") {
        if (!ignorado(m.target as Element)) acertaAtributos(m.target as Element, l);
      } else {
        m.addedNodes.forEach((n) => varre(n, l));
      }
    }
  });
  observador.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS,
  });

  varre(document.body, lang());
  aoMudarIdioma(() => varre(document.body, lang()));
}
