const fs = require('fs');

const url = "https://jezjbwryaawppufsikzo.supabase.co/rest/v1/torneos?select=*";
const headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDE1NDgsImV4cCI6MjA4NzE3NzU0OH0.pAqmCW8sIrnxiqRALCRnIA_kj7-COpoarYB_uKs6J-o",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDE1NDgsImV4cCI6MjA4NzE3NzU0OH0.pAqmCW8sIrnxiqRALCRnIA_kj7-COpoarYB_uKs6J-o"
};

async function check() {
    const t = await fetch(url, { headers }).then(r => r.json());
    const u = await fetch("https://jezjbwryaawppufsikzo.supabase.co/rest/v1/users?email=eq.master@torneo.com&select=id,email,rol,auth_id", { headers }).then(r => r.json());

    fs.writeFileSync('scripts/test_output.json', JSON.stringify({ torneos: t, users: u }, null, 2), 'utf8');
}

check();
