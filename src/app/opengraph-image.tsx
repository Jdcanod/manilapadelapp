import { ImageResponse } from "next/og";

/**
 * La tarjeta que se ve al compartir un enlace de Pádel Manía por WhatsApp.
 *
 * Antes no había ninguna: los enlaces salían pelados, sin imagen ni
 * descripción. Importa más de lo que parece porque compartir partidos por
 * WhatsApp es como se mueve la app.
 *
 * Se genera acá en vez de subir un PNG para no arrastrar otro archivo pesado
 * (el logo actual pesa 2,4 MB) y para que el texto siga a la marca si cambia.
 */

export const runtime = "edge";
export const alt = "Pádel Manía — Tu Club · Tu Juego · Tu Ranking";
/** 1200×630 es la proporción que esperan WhatsApp, iMessage y las redes. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "0 90px",
                    // Paleta vintage de la app: papel, oliva, ocre.
                    background: "#F5EFE0",
                    fontFamily: "sans-serif",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 34 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 999, background: "#A88A4B" }} />
                    <div
                        style={{
                            fontSize: 27,
                            letterSpacing: 9,
                            color: "#7E663C",
                            fontWeight: 700,
                            display: "flex",
                        }}
                    >
                        PÁDEL MANÍA
                    </div>
                </div>

                <div
                    style={{
                        fontSize: 88,
                        fontWeight: 900,
                        color: "#2A2A0A",
                        lineHeight: 1.04,
                        letterSpacing: -2,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <span>Tu club. Tu juego.</span>
                    <span style={{ color: "#5E6118" }}>Tu ranking.</span>
                </div>

                <div style={{ display: "flex", marginTop: 40, height: 7, width: 190, background: "#5E6118" }} />

                <div style={{ fontSize: 31, color: "#4A4A20", marginTop: 38, display: "flex" }}>
                    Torneos, partidos y ranking del pádel en Manizales
                </div>
            </div>
        ),
        size,
    );
}
