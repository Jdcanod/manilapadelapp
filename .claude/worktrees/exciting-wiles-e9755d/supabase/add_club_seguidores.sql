CREATE TABLE IF NOT EXISTS public.club_seguidores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    jugador_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(club_id, jugador_id)
);

-- Políticas de Seguridad (RLS)
ALTER TABLE public.club_seguidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura a todo publico" 
ON public.club_seguidores FOR SELECT 
USING (true);

CREATE POLICY "Permitir insertar a usuarios autenticados" 
ON public.club_seguidores FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir borrar a usuarios propios" 
ON public.club_seguidores FOR DELETE 
USING (auth.uid() IS NOT NULL);
