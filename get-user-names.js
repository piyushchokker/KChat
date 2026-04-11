#!/usr/bin/env node

async function main() {
  const [{ createClient }, dotenv] = await Promise.all([
    import("@supabase/supabase-js"),
    import("dotenv"),
  ]);

  dotenv.config({ path: ".env.local" });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.from('users').select('name');
  if (error) {
    console.error('Error fetching user names:', error.message);
    process.exit(1);
  }
  console.log('User names:');
  data.forEach((user, i) => console.log(`${i + 1}. ${user.name}`));
}

main();
