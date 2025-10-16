// Forzar el uso de Node.js Runtime para esta ruta
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { hash } from 'bcryptjs';
import { registerSchema } from '@/lib/validations/auth';
import { validateCSRFToken } from '@/lib/utils/csrf';

export async function POST(request: Request) {
  try {
    // Validar el tipo de contenido
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Tipo de contenido no soportado. Se espera application/json' 
        },
        { status: 415 }
      );
    }

    // Validar el cuerpo de la solicitud
    let body;
    try {
      body = await request.json();
    } catch{
      return NextResponse.json(
        { 
          success: false,
          error: 'El cuerpo de la solicitud no es un JSON válido' 
        },
        { status: 400 }
      );
    }

    // Validar token CSRF
    const csrfToken = body.csrfToken;
    if (!validateCSRFToken(csrfToken)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token CSRF inválido o faltante'
        },
        { status: 403 }
      );
    }

    // Validar datos con Zod
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      return NextResponse.json(
        {
          success: false,
          error: 'Error de validación',
          details: errors
        },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;

    // Verificar si el usuario ya existe
    try {
      const existingUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email),
        columns: { id: true }
      });

      if (existingUser) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Ya existe una cuenta con este correo electrónico' 
          },
          { status: 409 }
        );
      }
    } catch (dbError) {
      console.error('Error al verificar usuario existente:', dbError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Error al procesar la solicitud' 
        },
        { status: 500 }
      );
    }

    // Encriptar la contraseña
    let hashedPassword;
    try {
      hashedPassword = await hash(password, 12);
    } catch (hashError) {
      console.error('Error al hashear la contraseña:', hashError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Error al procesar la contraseña' 
        },
        { status: 500 }
      );
    }

    // Crear el usuario
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          password: hashedPassword,
          role: 'user',
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: users.id, email: users.email, name: users.name });

      return NextResponse.json(
        { 
          success: true,
          data: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name
          }
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error al crear el usuario:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Error al crear el usuario' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error inesperado:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}