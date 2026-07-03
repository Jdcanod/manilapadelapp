
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { TournamentReportTemplate } from "./TournamentReportTemplate";

interface Props {
    torneo: {
        id: string;
        nombre: string;
        formato: string;
        club_id?: string;
        club_rival_id?: string;
        club?: { nombre: string };
        club_rival?: { nombre: string };
    };
    clubInfo: {
        nombre: string;
        foto: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partidos: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participantes: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    grupos: any[];
    currentClubId: string;
}

export function TournamentExportButton({ torneo, clubInfo, partidos, participantes, grupos, currentClubId }: Props) {
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const handleExport = async () => {
        setIsExporting(true);
        console.log(`Generando reporte profesional para ${torneo.nombre}`);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1200));

            const container = reportRef.current;
            if (!container) {
                alert("Error al preparar el reporte.");
                setIsExporting(false);
                return;
            }
            
            // Forzamos un pequeño repintado para asegurar que los estilos de modo misterio se apliquen
            container.style.display = "block";
            await new Promise(resolve => setTimeout(resolve, 300));

            // Secciones normales (.pdf-section) se pegan como bloque completo.
            // Secciones fluidas (.pdf-flow) se cortan en el límite exacto de una
            // fila (.pdf-row) al llenar cada página — tabla continua sin huecos.
            const sections = Array.from(container.querySelectorAll('.pdf-section, .pdf-flow'));
            if (sections.length === 0) {
                alert("No se encontraron secciones para exportar.");
                setIsExporting(false);
                return;
            }

            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const contentWidth = pdfWidth - (2 * margin);

            let currentY = margin;

            // Recorta una franja [startPx, endPx) del canvas y la agrega al PDF.
            const addSlice = (canvas: HTMLCanvasElement, startPx: number, endPx: number) => {
                const slice = document.createElement('canvas');
                slice.width = canvas.width;
                slice.height = Math.max(1, Math.round(endPx - startPx));
                const ctx = slice.getContext('2d')!;
                ctx.drawImage(canvas, 0, startPx, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
                const hMm = (slice.height * contentWidth) / canvas.width;
                pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, currentY, contentWidth, hMm);
                currentY += hMm;
            };

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i] as HTMLElement;

                const canvas = await html2canvas(section, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#F4EFE6",
                    width: section.offsetWidth,
                    height: section.offsetHeight
                });

                if (section.classList.contains('pdf-flow')) {
                    // Límites de corte en px del canvas: el borde inferior de cada fila
                    const pxScale = canvas.height / section.offsetHeight;
                    const sectionTop = section.getBoundingClientRect().top;
                    const boundaries = Array.from(section.querySelectorAll('.pdf-row'))
                        .map(r => {
                            const rect = (r as HTMLElement).getBoundingClientRect();
                            return (rect.bottom - sectionTop) * pxScale;
                        })
                        .sort((a, b) => a - b);
                    boundaries.push(canvas.height);

                    let startPx = 0;
                    while (startPx < canvas.height - 1) {
                        const availMm = pdfHeight - margin - currentY;
                        const availPx = (availMm * canvas.width) / contentWidth;
                        // El mayor límite de fila que cabe en lo que queda de página
                        const fit = boundaries.filter(b => b > startPx + 1 && b <= startPx + availPx).pop();
                        if (fit !== undefined) {
                            addSlice(canvas, startPx, fit);
                            startPx = fit;
                        } else if (currentY > margin) {
                            // No cabe ni una fila: página nueva
                            pdf.addPage();
                            currentY = margin;
                        } else {
                            // Fila más alta que una página entera: corte forzado
                            const forced = Math.min(startPx + availPx, canvas.height);
                            addSlice(canvas, startPx, forced);
                            startPx = forced;
                        }
                    }
                    currentY += 2;
                    continue;
                }

                const imgData = canvas.toDataURL("image/png");
                const sectionHeightMm = (canvas.height * contentWidth) / canvas.width;

                // Si la sección no cabe en la página actual (y no es la primera sección de la página)
                if (currentY + sectionHeightMm > pdfHeight - margin && currentY > margin) {
                    pdf.addPage();
                    currentY = margin;
                }

                pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, sectionHeightMm);
                currentY += sectionHeightMm + 2; // 2mm de espacio entre secciones
            }

            pdf.save(`Reporte-${torneo.nombre}.pdf`);
        } catch (error) {
            console.error("Error exportando PDF:", error);
            alert("Hubo un error al generar el PDF.");
        } finally {
            setIsExporting(false);
            if (reportRef.current) reportRef.current.style.display = "none";
        }
    };

    return (
        <>
            <Button 
                onClick={handleExport} 
                disabled={isExporting}
                variant="outline" 
                className="bg-paper-soft border-olive/20 text-ink hover:bg-paper-dark hover:text-ink gap-2"
            >
                {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <FileDown className="w-4 h-4" />
                )}
                Exportar Reporte
            </Button>

            {/* Contenedor invisible para el reporte */}
            <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                <TournamentReportTemplate 
                    ref={reportRef}
                    torneo={torneo}
                    clubInfo={clubInfo}
                    partidos={partidos}
                    participantes={participantes}
                    grupos={grupos}
                    currentClubId={currentClubId}
                />
            </div>
        </>
    );
}
