import { OAuth2Client } from 'google-auth-library';

// Configura las credenciales de Mercado Libre
const CLIENT_ID = process.env.MERCADOLIBRE_CLIENT_ID!;
const CLIENT_SECRET = process.env.MERCADOLIBRE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/auth/callback/mercadolibre`;

export const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Genera la URL de autorización
export function getAuthorizationUrl(state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'profile', 'email'],
    state,
  });
}

// Intercambia el código por un token de acceso
export async function getToken(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}
