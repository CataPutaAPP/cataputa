// Privora — service worker
// Não guarda nada em cache: em app de uso privado, cache é risco de vazamento.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* sempre direto da rede */ });

// Aviso com o app fechado
self.addEventListener("push", (event) => {
  let dados = { title: "Privora", body: "", url: "/" };
  try { dados = { ...dados, ...(event.data ? event.data.json() : {}) }; } catch { /* texto simples */ }

  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: dados.url || "/" },
      // agrupa por tipo para não empilhar dezenas de avisos iguais
      tag: dados.title,
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ("focus" in aba) { aba.navigate(destino); return aba.focus(); }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
