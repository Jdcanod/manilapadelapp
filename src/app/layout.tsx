import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ManilaPadelAPP | Comunidad Pádel Manizales",
  description: "La comunidad de pádel en Manizales. Encuentra partidos, clubes y compite en el ranking.",
  metadataBase: new URL('https://manilapadel.com'), // Replace with actual URL
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-50 antialiased`}>
        {children}
      </body>
    </html>
  );
}
