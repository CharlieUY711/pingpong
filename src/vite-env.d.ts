/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_KEY: string;
  readonly VITE_ADMIN_EMAIL: string;
  // más variables de entorno si las hay
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
