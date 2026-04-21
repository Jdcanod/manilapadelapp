
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'partidos' });
  
  if (error) {
    // If RPC doesn't exist, try a simple select
    const { data: sample, error: selectError } = await supabase.from('partidos').select('*').limit(1);
    if (selectError) {
      console.error(selectError);
    } else {
      console.log('Columns in partidos:', Object.keys(sample[0] || {}));
    }
    return;
  }
  console.log(data);
}

checkColumns();
