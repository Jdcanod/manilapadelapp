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
    metadataBase: new URL("https://manilapadelapp.vercel.app"), // actualizar cuando haya dominio propio
    // Nombre corto bajo el ícono al guardar en la pantalla de inicio (iOS)
    appleWebApp: {
        title: "Pádel Manía",
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
