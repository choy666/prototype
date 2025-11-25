import { NextResponse } from 'next/server';

// Endpoint deshabilitado: la funcionalidad de "Sugerir categoría ML" fue removida.
export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint de sugerencia de categoría ML deshabilitado.' },
    { status: 410 }
  );
}
