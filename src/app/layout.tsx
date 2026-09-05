import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
});

const bebas = Bebas_Neue({
    subsets: ["latin"],
    weight: "400",
    variable: "--font-display",
});

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
        <html lang="es" className={`${inter.variable} ${bebas.variable}`}>
            <body className="min-h-screen bg-paper text-ink antialiased font-sans">
                {children}
                <Toaster />
            </body>
        </html>
    );
}
