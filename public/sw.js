/**
 * Service worker de Pádel Manía.
 *
 * Su única razón de existir hoy es el push: es el que recibe el aviso cuando la
 * app está cerrada. No cachea nada a propósito — un caché mal hecho sirve
 * pantallas viejas, y la app depende de datos que cambian (marcadores, cupos).
 */

self.addEventListener('install', () => {
    // Sin esto habría que cerrar todas las pestañas para estrenar una versión.
    self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(self.clients.claim());
});

self.addEventListener('push', (evento) => {
    let datos = {};
    try {
        datos = evento.data ? evento.data.json() : {};
    } catch {
        // Un push sin JSON válido igual debe mostrar algo antes que nada.
        datos = { titulo: 'Pádel Manía' };
    }

    const titulo = datos.titulo || 'Pádel Manía';
    const opciones = {
        body: datos.mensaje || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // Agrupa por tipo: diez avisos de un mismo partido no deben apilarse
        // como diez notificaciones separadas en la bandeja.
        tag: datos.tag || 'padelmania',
        renotify: true,
        data: { link: datos.link || '/notificaciones' },
    };

    evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (evento) => {
    evento.notification.close();
    const destino = (evento.notification.data && evento.notification.data.link) || '/notificaciones';

    evento.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
            // Si la app ya está abierta se reutiliza esa ventana: abrir una
            // segunda pestaña de lo mismo desorienta.
            for (const ventana of ventanas) {
                if ('focus' in ventana) {
                    ventana.navigate(destino).catch(() => { });
                    return ventana.focus();
                }
            }
            return self.clients.openWindow(destino);
        })
    );
});
