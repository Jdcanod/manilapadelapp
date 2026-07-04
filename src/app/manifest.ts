import type { MetadataRoute } from "next";

/**
 * Web App Manifest — Android/Chrome lo usa para el ícono y nombre al
 * "Añadir a pantalla de inicio". display: standalone hace que al abrirse
 * desde el acceso directo se vea como app (sin barra del navegador).
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Pádel Manía | Tu Club · Tu Juego · Tu Ranking",
        short_name: "Pádel Manía",
        description:
            "Pádel Manía es la comunidad de pádel: encuentra partidos, gestiona torneos, compite en el ranking y construye tu juego.",
        start_url: "/",
        display: "standalone",
        background_color: "#F5EFE0",
        theme_color: "#5E6118",
        icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
