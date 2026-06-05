import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
    /** Tamaño del sello (logo). 'sm' compacto, 'md' default, 'lg' hero. */
    size?: "sm" | "md" | "lg";
    /** Si false, solo muestra el logo sin el texto "PÁDEL MANÍA". */
    showText?: boolean;
    /** Tono de tipografía / texto. 'auto' usa olive sobre paper, 'light' sobre fondos oscuros, 'dark' sobre claros. */
    tone?: "auto" | "light" | "dark";
    /** Ruta de destino. Si es null, no envuelve en <Link>. */
    href?: string | null;
    /** Clase extra para el wrapper. */
    className?: string;
}

const sizes = {
    sm: { logo: 32, text: "text-base" },
    md: { logo: 44, text: "text-xl" },
    lg: { logo: 72, text: "text-3xl" },
};

/**
 * Logo + nombre "PÁDEL MANÍA" usado en headers y pantallas con la marca.
 * El archivo de imagen vive en /public/logo.png — reemplázalo cuando
 * tengas el SVG/PNG limpio.
 */
export function BrandLogo({ size = "md", showText = true, tone = "auto", href = "/", className }: Props) {
    const s = sizes[size];
    const colorClass =
        tone === "light"
            ? "text-paper"
            : tone === "dark"
                ? "text-ink"
                : "text-olive";

    const content = (
        <span className={cn("inline-flex items-center gap-3", className)}>
            <span
                className="inline-flex items-center justify-center"
                style={{ width: s.logo, height: s.logo }}
            >
                <Image
                    src="/logo.png"
                    alt="Pádel Manía"
                    width={s.logo}
                    height={s.logo}
                    className="w-full h-full object-contain"
                    priority={size === "lg"}
                />
            </span>
            {showText && (
                <span className={cn("font-display tracking-[0.08em] uppercase leading-none", s.text, colorClass)}>
                    Pádel <span className="text-ochre">Manía</span>
                </span>
            )}
        </span>
    );

    if (href === null) return content;
    return <Link href={href}>{content}</Link>;
}
