// Service worker mínimo — necessário para o app ser instalável na tela inicial.
// Não guarda nada em cache: em app de uso privado, cache é risco de vazamento.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* sempre direto da rede */ });
