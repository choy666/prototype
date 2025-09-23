import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { hash } from 'bcryptjs';
import { z } from 'zod';

// Esquema de validación mejorado
const registerSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder los 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  
  email: z.string()
    .email('Por favor ingresa un correo electrónico válido')
    .min(5, 'El correo electrónico es demasiado corto')
    .max(100, 'El correo electrónico es demasiado largo')
    .toLowerCase()
    .trim(),
    
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede exceder los 100 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial'),
});

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
    } catch (error) {
      return NextResponse.json(
        { 
          success: false,
          error: 'El cuerpo de la solicitud no es un JSON válido' 
        },
        { status: 400 }
      );
    }

    // Validar datos con Zod
    const validation = registerSchema.safeParse(body);
    
    // Por esta otra:
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
            error: 'Ya existe una cuenta con este correo electrónico. ¿Olvidaste tu contraseña?' 
          },
          { status: 409 } // 409 Conflict es más apropiado para recursos duplicados
        );
      }
    } catch (dbError) {
      console.error('Error al verificar usuario existente:', dbError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Error al procesar la solicitud. Por favor, inténtalo de nuevo más tarde.' 
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
          error: 'Error al procesar la contraseña. Por favor, inténtalo de nuevo.' 
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
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        });

      // Enviar correo de verificación (ejemplo, implementar según necesidad)
      // await sendVerificationEmail(newUser.email, newUser.name);

      return NextResponse.json(
        { 
          success: true,
          data: {
            user: newUser,
            message: '¡Registro exitoso! Por favor verifica tu correo electrónico.'
          }
        },
        { status: 201 }
      );
    } catch (dbError) {
      console.error('Error al crear el usuario:', dbError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Error al crear la cuenta. Por favor, inténtalo de nuevo.' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error inesperado en el registro:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo más tarde.' 
      },
      { status: 500 }
    );
  }
}

// Opcional: Endpoint para verificar si un correo ya está registrado
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Se requiere un correo electrónico' 
        },
        { status: 400 }
      );
    }

    // Validar formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Por favor ingresa un correo electrónico válido' 
        },
        { status: 400 }
      );
    }

    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
      columns: { id: true }
    });

    return NextResponse.json({ 
      success: true,
      data: { 
        exists: !!existingUser,
        message: existingUser 
          ? 'Este correo electrónico ya está registrado' 
          : 'Correo electrónico disponible'
      }
    });
  } catch (error) {
    console.error('Error al verificar el correo:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al verificar el correo electrónico. Por favor, inténtalo de nuevo.' 
      },
      { status: 500 }
    );
  }
}