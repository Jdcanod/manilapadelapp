
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
            // Esperar un momento para que el componente oculto se renderice bien
            await new Promise(resolve => setTimeout(resolve, 500));

            const element = reportRef.current;
            if (!element) {
                alert("Error al preparar el reporte.");
                setIsExporting(false);
                return;
            }

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff", // Fondo blanco para PDF profesional
                windowWidth: 800,
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
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
