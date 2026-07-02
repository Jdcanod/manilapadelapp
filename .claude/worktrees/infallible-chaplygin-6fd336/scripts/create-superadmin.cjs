const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');

let url = '';
let key = '';

for (const rawLine of env) {
    const line = rawLine.trim();
    if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        url = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
    if (line.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        const val = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
        if (val) key = val;
    }
    if (line.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        if (!key) key = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function createSuperAdmin() {
    const email = 'superadmin@padelmaniaapp.com';
    const password = 'Colombia123';

    console.log(`Intentando crear/registrar usuario: ${email}`);

    // 1. Sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                nombre: 'Super Administrador'
            }
        }
    });

    if (signUpError) {
        console.error("Error en el registro (signUp):", signUpError.message);
        // Maybe the user already exists, let's try to sign in
        if (signUpError.message.includes('User already registered') || signUpError.status === 400) {
            console.log("El usuario ya existe. Intentando login...");
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) {
                console.error("Error en login:", signInError.message);
                return;
            }
        } else {
            return;
        }
    } else {
        console.log("Usuario registrado con éxito en auth.");
    }

    // Await for trigger to potentially create the user row in public.users
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Fetch user from public.users to get their ID
    const { data: userRow, error: findErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (findErr || !userRow) {
        console.error("No se encontró el usuario en public.users:", findErr?.message);

        // Sometimes signUp returns the user id directly in an active session
        const sessionRes = await supabase.auth.getSession();
        const userId = sessionRes.data?.session?.user?.id;

        if (userId) {
            console.log("Intentando insertar manualmente en public.users...");
            const { error: insertErr } = await supabase
                .from('users')
                .insert([{
                    id: userId,
                    email: email,
                    nombre: 'Super Administrador',
                    rol: 'superadmin'
                }]);

            if (insertErr) {
                console.error("Error insertando en public.users:", insertErr.message);
            } else {
                console.log("Usuario insertado y rol actualizado a superadmin.");
            }
        }
        return;
    }

    // 3. Update role to superadmin
    console.log(`Encontrado en public.users (ID: ${userRow.id}). Actualizando rol...`);
    const { error: updateErr } = await supabase
        .from('users')
        .update({ rol: 'superadmin' })
        .eq('id', userRow.id);

    if (updateErr) {
        console.error("Error actualizando rol:", updateErr.message);
    } else {
        console.log("¡Éxito! El usuario ahora tiene el rol de superadmin.");
    }
}

createSuperAdmin();
