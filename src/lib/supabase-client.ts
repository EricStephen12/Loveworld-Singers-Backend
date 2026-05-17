// Supabase Client for LoveWorld Singers App
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
 console.error(' Missing Supabase environment variables!');
 console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? ' Set' : ' Missing');
 console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? ' Set' : ' Missing');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
