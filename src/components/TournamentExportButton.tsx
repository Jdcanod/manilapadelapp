
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { TournamentReportTemplate } from "./TournamentReportTemplate";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

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
    const [isOpen, setIsOpen] = useState(false);
    const [modoMisterio, setModoMisterio] = useState(false);
    const [nombreClubExporta, setNombreClubExporta] = useState("");
    const [soloLogosManila, setSoloLogosManila] = useState(false);
    
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
                
                pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, sectionHeightMm);
                currentY += sectionHeightMm + 5; // 5mm de espacio entre secciones
            }

            pdf.save(`Reporte-${torneo.nombre}.pdf`);
            setIsOpen(false);
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
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button 
                        variant="outline" 
                        className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white gap-2"
                    >
                        <FileDown className="w-4 h-4" />
                        Exportar Reporte
                    </Button>
                </DialogTrigger>
                <DialogContent className="bg-neutral-900 border-neutral-800 text-white sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Exportar Reporte de Torneo</DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Configura las opciones de exportación del PDF. Útil para torneos tipo Copa Davis.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="clubName">Nombre del Club en el Reporte</Label>
                            <Input 
                                id="clubName"
                                placeholder={clubInfo.nombre} 
                                value={nombreClubExporta}
                                onChange={(e) => setNombreClubExporta(e.target.value)}
                                className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-600"
                            />
                            <p className="text-xs text-neutral-500">Si lo dejas en blanco, se usará el nombre de tu club.</p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="soloLogos" 
                                checked={soloLogosManila}
                                onCheckedChange={(checked) => setSoloLogosManila(checked as boolean)}
                                className="border-neutral-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <Label htmlFor="soloLogos" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Mostrar solo logos de Padel Manila
                            </Label>
                        </div>
                        
                        <div className="flex items-start space-x-2 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                            <Checkbox 
                                id="modoMisterio" 
                                checked={modoMisterio}
                                onCheckedChange={(checked) => setModoMisterio(checked as boolean)}
                                className="mt-1 border-neutral-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="modoMisterio" className="text-sm font-medium text-amber-500">
                                    Modo Misterio (Copa Davis)
                                </Label>
                                <p className="text-xs text-neutral-400">
                                    Oculta los nombres de las parejas en el reporte para mantener el misterio ante el club contrincante.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 hover:text-white">
                            Cancelar
                        </Button>
                        <Button onClick={handleExport} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white">
                            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                            Generar PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Contenedor invisible para el reporte */}
            <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                <TournamentReportTemplate 
                    ref={reportRef}
                    torneo={torneo}
                    clubInfo={clubInfo}
                    partidos={partidos}
                    participantes={participantes}
                    grupos={grupos}
                    modoMisterio={modoMisterio}
                    nombreClubExporta={nombreClubExporta}
                    soloLogosManila={soloLogosManila}
                />
            </div>
        </>
    );
}
