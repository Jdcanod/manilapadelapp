export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4 relative overflow-hidden text-ink">
            {/* Textura sutil de papel */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.05]"
                style={{
                    backgroundImage:
                        "radial-gradient(circle at 15% 20%, rgba(94,97,24,0.4), transparent 40%), radial-gradient(circle at 85% 80%, rgba(168,138,75,0.3), transparent 40%)",
                }}
            />

            <div className="relative z-10 w-full max-w-xl">{children}</div>
        </div>
    );
}
