const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  const { data, error } = await supabase
    .from('partidos')
    .select('lugar, fecha')
    .limit(10);

  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

checkData();
