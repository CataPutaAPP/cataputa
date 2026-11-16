/**
 * Estimativa de idade no próprio aparelho.
 * A câmera é analisada dentro do navegador: nenhuma imagem é enviada ou guardada.
 * Só o número final (idade estimada) vai para o servidor.
 *
 * Usa a biblioteca aberta face-api (carregada sob demanda, só nesta tela).
 */
const VERSAO_LIB = "1.7.15";
const BASE = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${VERSAO_LIB}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceApi = any;
let pronto: Promise<FaceApi> | null = null;

function carregarScript(src: string): Promise<void> {
  return new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => ok();
    s.onerror = () => erro(new Error("Não foi possível carregar o verificador. Confira sua internet."));
    document.head.appendChild(s);
  });
}

/** Carrega a biblioteca e os dois modelos (detector de rosto + idade). Cerca de 2 MB, uma vez. */
export function carregarEstimador(): Promise<FaceApi> {
  if (!pronto) {
    pronto = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.faceapi) await carregarScript(`${BASE}/dist/face-api.js`);
      const faceapi = w.faceapi;
      if (!faceapi) throw new Error("Verificador indisponível neste navegador.");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(`${BASE}/model`),
        faceapi.nets.ageGenderNet.loadFromUri(`${BASE}/model`),
      ]);
      return faceapi;
    })().catch((e) => { pronto = null; throw e; });
  }
  return pronto;
}

export interface Leitura { idade: number; largura: number }

/** Uma leitura do vídeo: idade estimada e quanto do quadro o rosto ocupa (0 a 1). Null se não achou rosto. */
export async function lerRosto(faceapi: FaceApi, video: HTMLVideoElement): Promise<Leitura | null> {
  const r = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withAgeAndGender();
  if (!r || typeof r.age !== "number") return null;
  const larguraVideo = video.videoWidth || 1;
  return { idade: r.age, largura: r.detection.box.width / larguraVideo };
}

/** Média das leituras descartando a menor e a maior, para não depender de um quadro ruim. */
export function consolidar(idades: number[]): number {
  const o = [...idades].sort((a, b) => a - b);
  const meio = o.length > 4 ? o.slice(1, -1) : o;
  return meio.reduce((s, x) => s + x, 0) / meio.length;
}
