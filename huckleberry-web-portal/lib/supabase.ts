import { createClient } from "@supabase/supabase-js";
import { ENV_CONFIG } from "@/src/config/environment";

// Mock Supabase client for CI environments
class MockSupabaseClient {
  storage: any;
  from: any;
  
  constructor() {
    this.storage = {
      from: () => ({
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ error: null }),
        upload: async () => ({ data: { path: '' }, error: null }),
      }),
    };
    
    this.from = () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: [], error: null }),
      update: () => ({ data: [], error: null }),
      delete: () => ({ data: [], error: null }),
    });
  }
}

export function getSupabaseClient(isServer: boolean = true) {
  const url = ENV_CONFIG.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ENV_CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = ENV_CONFIG.SUPABASE_SERVICE_ROLE_KEY;

  // Check if we're in a CI/build environment without proper env vars
  if (!url || !anon) {
    // In CI/build environment, return a mock client to prevent build failures
    if (process.env.CI || process.env.NODE_ENV === 'development') {
      console.warn('Supabase not configured - using mock client for CI/build');
      return new MockSupabaseClient();
    } else {
      throw new Error("Missing Supabase configuration - check environment variables");
    }
  }

  if (isServer) {
    const key = service || anon;
    if (!key) {
      if (process.env.CI || process.env.NODE_ENV === 'development') {
        console.warn('Supabase service key not configured - using mock client for CI/build');
        return new MockSupabaseClient();
      } else {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
      }
    }
    return createClient(url, key, { auth: { persistSession: false } });
  }

  if (!anon) {
    if (process.env.CI || process.env.NODE_ENV === 'development') {
      console.warn('Supabase anon key not configured - using mock client for CI/build');
      return new MockSupabaseClient();
    } else {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  }
  return createClient(url, anon);
}