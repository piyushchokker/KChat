#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase.from('users').select('name');
  if (error) {
    console.error('Error fetching user names:', error.message);
    process.exit(1);
  }
  console.log('User names:');
  data.forEach((user, i) => console.log(`${i + 1}. ${user.name}`));
}

main();
