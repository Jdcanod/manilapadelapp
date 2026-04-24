
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
}

export function TournamentExportButton({ torneo, clubInfo, partidos, participantes, grupos }: Props) {
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

            const sections = Array.from(container.querySelectorAll('.pdf-section'));
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

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i] as HTMLElement;
                
                const canvas = await html2canvas(section, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    width: section.offsetWidth,
                    height: section.offsetHeight
                });

                const imgData = canvas.toDataURL("image/png");
                const sectionHeightMm = (canvas.height * contentWidth) / canvas.width;

                // Si la sección no cabe en la página actual (y no es la primera sección de la página)
                if (currentY + sectionHeightMm > pdfHeight - margin && currentY > margin) {
                    pdf.addPage();
                    currentY = margin;
                }

                // Si es la cabecera, podemos darle un estilo especial o margen
                const isHeader = section.classList.contains('pdf-header');
                
                pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, sectionHeightMm);
                currentY += sectionHeightMm + 5; // 5mm de espacio entre secciones
            }

            pdf.save(`Reporte-${torneo.nombre}.pdf`);
        } catch (error) {
            console.error("Error exportando PDF:", error);
            alert("Hubo un error al generar el PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <Button 
                onClick={handleExport} 
                disabled={isExporting}
                variant="outline" 
                className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white gap-2"
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
                />
            </div>
        </>
    );
}
