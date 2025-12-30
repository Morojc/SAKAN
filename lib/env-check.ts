/**
 * Environment Variable Validation
 * Checks for required environment variables and logs warnings if missing
 */

export function checkRequiredEnvVars() {
  const required = {
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    
    // Auth
    AUTH_SECRET: process.env.AUTH_SECRET,
  };

  const missing: string[] = [];
  const present: string[] = [];

  Object.entries(required).forEach(([key, value]) => {
    if (!value || value === '' || value === 'undefined') {
      missing.push(key);
    } else {
      present.push(key);
    }
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n⚠️  Application may not function correctly!\n');
  }

  if (present.length > 0 && process.env.NODE_ENV === 'development') {
    console.log('✅ Found environment variables:', present.join(', '));
  }

  return {
    isValid: missing.length === 0,
    missing,
    present,
  };
}

