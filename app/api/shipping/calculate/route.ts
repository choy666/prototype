// Endpoint duplicado - redirigir al endpoint correcto
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = '/api/shipments/calculate';
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });
  
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Este endpoint está obsoleto. Use /api/shipments/calculate en su lugar.' 
  });
}
