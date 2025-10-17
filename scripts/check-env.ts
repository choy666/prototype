// scripts/check-env.ts
import dotenv from 'dotenv';
import process from "process";

// Cargar variables de entorno desde .env.vercel para producción
dotenv.config({ path: '.env.local' });

type EnvCheck = {
  key: string;
  expected?: string | RegExp;
  required?: boolean;
  mustInclude?: string;
};

const checks: EnvCheck[] = [
  // --- Proyecto base ---
  { key: "APP_URL", expected: "https://prototype-ten-dun.vercel.app" },
  { key: "NEXT_PUBLIC_APP_URL", expected: "https://prototype-ten-dun.vercel.app" },
  { key: "NEXTAUTH_URL", expected: "https://prototype-ten-dun.vercel.app" },
  { key: "NEXTAUTH_COOKIE_DOMAIN", expected: "prototype-ten-dun.vercel.app" },
  { key: "NODE_ENV", expected: "production" },

  // --- Neon / Postgres ---
  { key: "DATABASE_URL", mustInclude: "neon.tech" },
  { key: "DATABASE_URL_UNPOOLED", mustInclude: "neon.tech" },
  { key: "POSTGRES_PRISMA_URL", mustInclude: "neon.tech" },
  { key: "POSTGRES_URL", mustInclude: "neon.tech" },
  { key: "POSTGRES_URL_NON_POOLING", mustInclude: "neon.tech" },
  { key: "PGHOST", mustInclude: "neon.tech" },
  { key: "PGUSER", expected: "neondb_owner" },
  { key: "PGPASSWORD", required: true },
  { key: "PGDATABASE", expected: "neondb" },

  // --- Mercado Pago ---
  {
    key: "MERCADO_PAGO_ACCESS_TOKEN",
    expected:
      "APP_USR-4139456255448018-101508-30747435c7ebba43879b7e69055d3e14-2926966384",
  },
  {
    key: "NEXT_PUBLIC_MP_PUBLIC_KEY",
    expected: "APP_USR-2880d7a3-8d60-4ec8-ba83-c57f3c8da89e",
  },
  {
    key: "MERCADO_PAGO_WEBHOOK_SECRET",
    expected:
      "ea838b6e15e30982f237d7a8197ed0df2d8c5299d42879d3e59331b25dfc49bd",
  },
  {
    key: "MERCADO_PAGO_NOTIFICATION_URL",
    expected: "https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago",
  },

  // --- NextAuth ---
  { key: "NEXTAUTH_SECRET", required: true },

  // --- Stack ---
  { key: "NEXT_PUBLIC_STACK_PROJECT_ID", required: true },
  { key: "NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY", required: true },
  { key: "STACK_SECRET_SERVER_KEY", required: true },
];

let hasError = false;

function checkEnv({ key, expected, required, mustInclude }: EnvCheck) {
  const actual = process.env[key];

  if (!actual) {
    if (required) {
      console.error(`❌ ${key} está ausente`);
      hasError = true;
    } else {
      console.warn(`⚠️ ${key} no está definido`);
    }
    return;
  }

  if (expected && actual !== expected) {
    console.error(`❌ ${key} no coincide.
      Esperado: ${expected}
      Actual:   ${actual}`);
    hasError = true;
    return;
  }

  if (mustInclude && !actual.includes(mustInclude)) {
    console.error(`❌ ${key} no contiene la cadena esperada: ${mustInclude}
      Actual: ${actual}`);
    hasError = true;
    return;
  }

  console.log(`✅ ${key} OK`);
}

// Ejecutar validaciones
for (const check of checks) {
  checkEnv(check);
}

if (hasError) {
  console.error("❌ Verificación de variables de entorno fallida.");
  process.exit(1);
} else {
  console.log("🎉 Todas las variables de entorno críticas son válidas.");
}