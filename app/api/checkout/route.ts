// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth'; // Importamos el auth configurado
import { mercadoPago } from '@/lib/mercadopago';
import type { DefaultSession } from 'next-auth';
import { UserRole } from '@/lib/schema';

// Extendemos el tipo de sesión para incluir campos personalizados
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: UserRole;
    } & DefaultSession['user'];
  }
}

export async function POST(request: Request) {
  // Usamos auth() en lugar de getServerSession
  const session = await auth();
  
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    );
  }

  try {
    const { items } = await request.json();
    
    // Validación de items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items de compra inválidos' },
        { status: 400 }
      );
    }

    // Crear preferencia de pago
    const preference = {
      items,
      back_urls: {
        success: `${process.env.NEXTAUTH_URL}/checkout/success`,
        failure: `${process.env.NEXTAUTH_URL}/checkout/failure`,
        pending: `${process.env.NEXTAUTH_URL}/checkout/pending`,
      },
      auto_return: 'approved' as const,
      external_reference: session.user.email,
      notification_url: `${process.env.NEXTAUTH_URL}/api/checkout/webhook`,
    };

    // Crear preferencia en Mercado Pago
    const response = await mercadoPago.preferences.create({ 
      body: preference 
    });
    
    return NextResponse.json({ 
      url: response.init_point || response.sandbox_init_point 
    });
  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);
    return NextResponse.json(
      { error: 'Error al procesar el pago' },
      { status: 500 }
    );
  }
}