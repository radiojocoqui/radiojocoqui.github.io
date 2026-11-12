
/*
  RADIO JOCOQUI
  Service Worker para notificaciones push
*/

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// Recibir notificaciones push
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }

  const title = "Radio Jocoqui";

  const options = {
    body: "Tienes una actualización de tu invitación.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "radio-jocoqui-invitacion",
    data: {
      url: "/invitaciones/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Abrir Radio Jocoqui al tocar la notificación
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const url = new URL(
    "/invitaciones/",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.openWindow(url)
  );
});
