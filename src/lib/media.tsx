import { useEffect, useState, type ImgHTMLAttributes, type VideoHTMLAttributes } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Fotos e vídeos privados.
 * O banco guarda o endereço "público" do arquivo; aqui ele é trocado por um link
 * assinado, que só quem está logado consegue gerar e que vence em 1 hora.
 * Assim nenhuma foto abre para quem só tem o link antigo ou não tem conta.
 */
const VALIDADE = 3600;                       // segundos
const cache = new Map<string, { url: string; vence: number }>();

function localizar(url: string): { bucket: string; path: string } | null {
  const m = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/.exec(url);
  if (!m || !m[1] || !m[2]) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

export async function assinar(url: string): Promise<string> {
  const alvo = localizar(url);
  if (!alvo) return url;                     // não é arquivo do nosso armazenamento
  const guardado = cache.get(url);
  if (guardado && guardado.vence > Date.now()) return guardado.url;
  const { data, error } = await supabase.storage.from(alvo.bucket).createSignedUrl(alvo.path, VALIDADE);
  if (error || !data?.signedUrl) return url; // enquanto a pasta ainda for pública, o endereço antigo funciona
  cache.set(url, { url: data.signedUrl, vence: Date.now() + (VALIDADE - 300) * 1000 });
  return data.signedUrl;
}

export function useSignedUrl(url: string | null | undefined): string | null {
  const [assinada, setAssinada] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setAssinada(null);
    if (!url) return;
    assinar(url).then((u) => { if (vivo) setAssinada(u); });
    return () => { vivo = false; };
  }, [url]);
  return assinada;
}

/** <img> que carrega pelo link assinado. Enquanto assina, mostra um fundo neutro do mesmo tamanho. */
export function SecureImg({ src, className, alt = "", ...resto }: ImgHTMLAttributes<HTMLImageElement> & { src?: string | null | undefined }) {
  const url = useSignedUrl(src);
  if (!url) return <div className={`animate-pulse bg-secondary ${className ?? ""}`} aria-hidden="true" />;
  return <img src={url} alt={alt} className={className} {...resto} />;
}

/** <video> que carrega pelo link assinado. */
export function SecureVideo({ src, className, ...resto }: VideoHTMLAttributes<HTMLVideoElement> & { src?: string | null | undefined }) {
  const url = useSignedUrl(src);
  if (!url) return <div className={`aspect-video animate-pulse bg-secondary ${className ?? ""}`} aria-hidden="true" />;
  return <video src={url} className={className} {...resto} />;
}
