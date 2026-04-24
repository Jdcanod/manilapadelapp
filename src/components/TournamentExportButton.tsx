
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Props {
    torneoNombre: string;
    clubNombre: string;
    clubLogo?: string;
    categoria: string;
    // Agregaremos más props según sea necesario para el contenido
}

export function TournamentExportButton({ torneoNombre, clubNombre, clubLogo, categoria }: Props) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        console.log(`Generando reporte para ${torneoNombre} - Club: ${clubNombre}`);
        try {
            // Buscamos los elementos que queremos exportar
            const element = document.getElementById("tournament-report-content");
            if (!element) {
                alert("No se encontró el contenido para exportar. Asegúrate de estar en la pestaña correcta.");
                setIsExporting(false);
                return;
            }

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#000000",
                logging: false,
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Metadata con el logo del club (si existe)
            if (clubLogo) {
                console.log("Logo del club detectado:", clubLogo);
            }

            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Reporte-${torneoNombre}-${categoria}.pdf`);
        } catch (error) {
            console.error("Error exportando PDF:", error);
            alert("Hubo un error al generar el PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
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
            Exportar Resumen
        </Button>
    );
}
