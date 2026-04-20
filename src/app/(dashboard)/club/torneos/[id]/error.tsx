"use client";

export default function TorneoError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="p-8 max-w-lg mx-auto">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 space-y-4">
                <h2 className="text-xl font-bold text-red-400">Error en la página del Torneo</h2>
                <p className="text-sm text-red-300 font-mono whitespace-pre-wrap break-all">
                    {error.message}
                </p>
                {error.digest && (
                    <p className="text-xs text-neutral-500">Digest: {error.digest}</p>
                )}
                <button
                    onClick={reset}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm"
                >
                    Reintentar
                </button>
            </div>
        </div>
    );
}
