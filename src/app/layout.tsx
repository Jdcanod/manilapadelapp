import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

/**
 * Las fuentes (Inter para el texto, Bebas Neue para los títulos) se cargan
 * desde Google Fonts en el navegador, y se llaman por su nombre real.
 *
 * Antes iban con next/font/google, que las descarga durante el build y nombra
 * las clases con una huella de lo descargado. En Vercel, la parte del
 * servidor y la de estilos quedaron con huellas distintas (la página pedía
 * __variable_d8ebd1 y el CSS definía __variable_f367f3): la variable de la
 * fuente quedaba sin definir y todo el sitio caía en Times. Por nombre no
 * hay huella que se pueda desajustar.
 */
const FUENTES = "https://fonts.googleapis.com/css2?family=Inter:wght@400..900&family=Bebas+Neue&display=swap";

export const metadata: Metadata = {
    title: "Pádel Manía | Tu Club · Tu Juego · Tu Ranking",
    description:
        "Pádel Manía es la comunidad de pádel: encuentra partidos, gestiona torneos, compite en el ranking y construye tu juego.",
    // Con www: el dominio sin www responde 308 hacia este, y una vista previa
    // que pasa por un redirect no siempre la sigue quien la genera.
    metadataBase: new URL("https://www.padelmaniaapp.com"),
    // Nombre corto bajo el ícono al guardar en la pantalla de inicio (iOS)
    appleWebApp: {
        title: "Pádel Manía",
    },
    // Sin esto los enlaces se comparten pelados, y compartir partidos por
    // WhatsApp es como se mueve la app. La imagen la genera
    // `opengraph-image.tsx`; Next la enlaza sola.
    openGraph: {
        type: "website",
        siteName: "Pádel Manía",
        locale: "es_CO",
        title: "Pádel Manía | Tu Club · Tu Juego · Tu Ranking",
        description:
            "Torneos, partidos y ranking del pádel en Manizales. Encuentra con quién jugar y sigue tu progreso.",
        url: "https://www.padelmaniaapp.com",
    },
    twitter: {
        card: "summary_large_image",
        title: "Pádel Manía | Tu Club · Tu Juego · Tu Ranking",
        description: "Torneos, partidos y ranking del pádel en Manizales.",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                {/* eslint-disable-next-line @next/next/no-page-custom-font */}
                <link rel="stylesheet" href={FUENTES} />
            </head>
            <body className="min-h-screen bg-paper text-ink antialiased font-sans">
                {children}
                <Toaster />
            </body>
        </html>
    );
}
