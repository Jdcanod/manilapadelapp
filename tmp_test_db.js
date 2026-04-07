const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkColumns() {
  const { data, error } = await supabase
    .from('partidos')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log('No data found to check columns');
  }
}

checkColumns();
