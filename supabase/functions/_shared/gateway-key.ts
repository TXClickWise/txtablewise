// Supabase publishable anon key (JWT-format) — vereist door de Edge Functions
// gateway als Authorization header, ook al heeft de function zelf verify_jwt=false.
// Deze key is publishable en mag in de codebase staan; staat ook in .env
// (VITE_SUPABASE_PUBLISHABLE_KEY) en in src/integrations/supabase/client.ts.
//
// We hardcoden hier de JWT-variant omdat Deno.env.get("SUPABASE_ANON_KEY") in
// nieuwere Supabase projecten de nieuwe sb_publishable_* string teruggeeft,
// die door de gateway niet als geldige Authorization Bearer wordt geaccepteerd.
export const SUPABASE_GATEWAY_JWT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiaHR6dGJweG1xbHpoeWVwaGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjE3OTAsImV4cCI6MjA5MjYzNzc5MH0.rbPfp5VdOkgPysCU57BpQoLikGyyZ-UYn9cKSaSPxvA";
