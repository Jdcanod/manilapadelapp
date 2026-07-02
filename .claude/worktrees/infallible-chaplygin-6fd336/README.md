# ManilaPadelAPP

La primera plataforma comunitaria para jugadores de pádel en Manizales. Compite, organiza y disfruta.

## Tech Stack
- Frontend: **Next.js 14** (App Router) + Tailwind CSS + shadcn/ui.
- Backend: **Supabase** (Postgres, Auth, Edge Functions).
- Notificaciones: Integraciones previstas con **Twilio (WhatsApp)** y Web Push API.

## Estructura del Proyecto
- `src/app`: Rutas del sistema (App Router).
- `src/components`: Componentes reutilizables UI y shadcn.
- `src/lib`: Utilidades, algoritmo ELO, cliente Supabase.
- `supabase/migrations`: Esquemas de base de datos (`initial_schema.sql`).
- `supabase/seed.sql`: Datos de prueba locales para Manizales.

## Instalación y Ejecución Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   Renombra `.env.example` a `.env.local` y completa tus credenciales de Supabase.

3. Correr migraciones de Base de datos:
   Dirígete a tu proyecto en Supabase, utiliza el SQL Editor y ejecuta en orden:
   a. `supabase/migrations/20260219000000_initial_schema.sql`
   b. `supabase/seed.sql`

4. Iniciar servidor local:
   ```bash
   npm run dev
   ```

5. Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## Roadmap de Desarrollo
Consultar archivo `task.md` para ver el avance y las fases restantes.
