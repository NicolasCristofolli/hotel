import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Public values the browser needs. Accepted with or without the VITE_ prefix
 * (some hosts discourage VITE_ names). Only these exact names are exposed —
 * never widen this to a prefix, or a secret like SUPABASE_SECRET_KEY could leak.
 */
const PUBLIC_ENV = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'HOTEL_ID', 'TURNSTILE_SITE_KEY'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const define = Object.fromEntries(
    PUBLIC_ENV.map((k) => [`import.meta.env.VITE_${k}`, JSON.stringify((env[`VITE_${k}`] || env[k] || '').trim())]),
  );
  return {
    plugins: [react()],
    server: { host: true },
    define,
  };
});
