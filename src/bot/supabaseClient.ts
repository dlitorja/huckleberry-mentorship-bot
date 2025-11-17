// src/bot/supabaseClient.ts
import 'dotenv/config';
import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';

// Configure connection pooling and performance options
const supabaseOptions: SupabaseClientOptions<'public'> = {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false, // Service role key doesn't need session persistence
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-client-info': 'huckleberry-mentorship-bot',
    },
  },
  // Connection pooling is handled by Supabase's connection pooler
  // The client will automatically use connection pooling when connecting through the pooler URL
};

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  supabaseOptions
);