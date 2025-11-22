import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, mercadolibreQuestions } from '@/lib/schema';
import { eq, and, count, isNull } from 'drizzle-orm';
import { makeAuthenticatedRequest, isConnected } from '@/lib/auth/mercadolibre';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';


interface QuestionResponse {
  questionId: string;
  status: 'success' | 'error';
  error?: string;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get('questionId');
    const itemId = searchParams.get('itemId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verificar conexión con Mercado Libre
    const connected = await isConnected(parseInt(session.user.id));
    if (!connected) {
      return NextResponse.json({ 
        error: 'Usuario no conectado a Mercado Libre' 
      }, { status: 400 });
    }

    if (questionId) {
      // Obtener pregunta específica
      const localQuestion = await db.query.mercadolibreQuestions.findFirst({
        where: eq(mercadolibreQuestions.mlQuestionId, questionId),
        with: {
          product: true,
        },
      });

      if (!localQuestion) {
        return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 });
      }

      return NextResponse.json(localQuestion);
    } else {
      // Obtener preguntas con filtros
      const whereConditions = [];

      if (itemId) {
        whereConditions.push(eq(mercadolibreQuestions.mlItemId, itemId));
      }

      if (status) {
        whereConditions.push(eq(mercadolibreQuestions.status, status as 'pending' | 'answered' | 'closed' | 'deleted'));
      }

      const whereCondition = whereConditions.length > 0 
        ? and(...whereConditions) 
        : undefined;

      const questions = await db.query.mercadolibreQuestions.findMany({
        where: whereCondition,
        with: {
          product: true,
        },
        limit,
        offset,
        orderBy: (mercadolibreQuestions, { desc }) => [
          desc(mercadolibreQuestions.createdAt),
        ],
      });

      // Obtener estadísticas
      const stats = await db
        .select({
          status: mercadolibreQuestions.status,
          count: count(mercadolibreQuestions.id),
        })
        .from(mercadolibreQuestions)
        .groupBy(mercadolibreQuestions.status);

      return NextResponse.json({
        questions,
        stats,
        pagination: {
          limit,
          offset,
          total: questions.length,
        },
      });
    }

  } catch (error) {
    logger.error('Error obteniendo preguntas', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { questionId, itemId, action, answer } = await req.json();

    if (!questionId && !itemId) {
      return NextResponse.json({ 
        error: 'Debe proporcionar questionId o itemId' 
      }, { status: 400 });
    }

    // Verificar conexión con Mercado Libre
    const connected = await isConnected(parseInt(session.user.id));
    if (!connected) {
      return NextResponse.json({ 
        error: 'Usuario no conectado a Mercado Libre' 
      }, { status: 400 });
    }

    if (action === 'sync') {
      // Sincronizar preguntas desde Mercado Libre
      return await syncQuestions(parseInt(session.user.id), itemId);
    } else if (action === 'answer') {
      // Responder una pregunta
      if (!questionId || !answer) {
        return NextResponse.json({ 
          error: 'questionId y answer son requeridos para responder' 
        }, { status: 400 });
      }
      return await answerQuestion(parseInt(session.user.id), questionId, answer);
    } else {
      return NextResponse.json({ 
        error: 'Acción no válida. Use "sync" o "answer"' 
      }, { status: 400 });
    }

  } catch (error) {
    logger.error('Error procesando solicitud de preguntas', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { questionId, status } = await req.json();

    if (!questionId || !status) {
      return NextResponse.json({ 
        error: 'questionId y status son requeridos' 
      }, { status: 400 });
    }

    // Verificar conexión con Mercado Libre
    const connected = await isConnected(parseInt(session.user.id));
    if (!connected) {
      return NextResponse.json({ 
        error: 'Usuario no conectado a Mercado Libre' 
      }, { status: 400 });
    }

    // Actualizar estado local de la pregunta
    const updatedQuestion = await db.update(mercadolibreQuestions)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(mercadolibreQuestions.mlQuestionId, questionId))
      .returning();

    if (updatedQuestion.length === 0) {
      return NextResponse.json({ 
        error: 'Pregunta no encontrada' 
      }, { status: 404 });
    }

    logger.info('Estado de pregunta actualizado', {
      questionId,
      status,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      question: updatedQuestion[0],
    });

  } catch (error) {
    logger.error('Error actualizando pregunta', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Funciones auxiliares
async function syncQuestions(userId: number, itemId?: string): Promise<NextResponse> {
  try {
    const url = '/questions/search';
    const params = new URLSearchParams();
    
    if (itemId) {
      params.append('item', itemId);
    } else {
      // Obtener todos los productos del usuario con ML item ID
      const userProducts = await db.query.products.findMany({
        where: and(
          eq(products.mlItemId, itemId || ''),
          isNull(products.mlItemId)
        ),
      });

      if (userProducts.length === 0) {
        return NextResponse.json({
          message: 'No hay productos sincronizados para obtener preguntas',
          questions: [],
        });
      }

      params.append('item', userProducts[0].mlItemId!);
    }

    params.append('status', 'UNANSWERED');
    params.append('limit', '50');

    const response = await makeAuthenticatedRequest(
      userId,
      `${url}?${params.toString()}`
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        `Error obteniendo preguntas de ML: ${errorData}`,
        { status: response.status, error: errorData }
      );
    }

    const questionsData = await response.json();
    const questions = questionsData.questions || [];

    const syncResults: QuestionResponse[] = [];

    for (const mlQuestion of questions) {
      const result: QuestionResponse = {
        questionId: mlQuestion.id,
        status: 'error',
      };

      try {
        // Verificar si ya existe
        const existingQuestion = await db.query.mercadolibreQuestions.findFirst({
          where: eq(mercadolibreQuestions.mlQuestionId, mlQuestion.id),
        });

        if (existingQuestion) {
          result.status = 'success';
          syncResults.push(result);
          continue;
        }

        // Buscar producto local
        const localProduct = await db.query.products.findFirst({
          where: eq(products.mlItemId, mlQuestion.item_id),
        });

        if (!localProduct) {
          result.status = 'error';
          result.error = 'Producto no encontrado';
          syncResults.push(result);
          continue;
        }

        // Crear registro de pregunta
        await db.insert(mercadolibreQuestions).values({
          productId: localProduct.id,
          mlQuestionId: mlQuestion.id,
          mlItemId: mlQuestion.item_id,
          questionText: mlQuestion.text,
          status: 'pending',
          mlBuyerId: mlQuestion.from?.id?.toString(),
          mlBuyerNickname: mlQuestion.from?.nickname,
          questionDate: new Date(mlQuestion.date_created),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        result.status = 'success';

        logger.info('Pregunta sincronizada', {
          questionId: mlQuestion.id,
          productId: localProduct.id,
        });

      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        logger.error('Error sincronizando pregunta', {
          questionId: mlQuestion.id,
          error: result.error,
        });
      }

      syncResults.push(result);
    }

    const successCount = syncResults.filter(r => r.status === 'success').length;
    const errorCount = syncResults.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      summary: {
        total: questions.length,
        successful: successCount,
        failed: errorCount,
      },
      results: syncResults,
    });

  } catch (error) {
    logger.error('Error sincronizando preguntas', {
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

async function answerQuestion(userId: number, questionId: string, answer: string): Promise<NextResponse> {
  try {
    // Responder pregunta en Mercado Libre
    const response = await makeAuthenticatedRequest(
      userId,
      `/answers`,
      {
        method: 'POST',
        body: JSON.stringify({
          question_id: questionId,
          text: answer,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        `Error respondiendo pregunta en ML: ${errorData}`,
        { status: response.status, error: errorData }
      );
    }

    const answerData = await response.json();

    // Actualizar pregunta local
    const updatedQuestion = await db.update(mercadolibreQuestions)
      .set({
        answerText: answer,
        status: 'answered',
        answerDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mercadolibreQuestions.mlQuestionId, questionId))
      .returning();

    if (updatedQuestion.length === 0) {
      return NextResponse.json({ 
        error: 'Pregunta no encontrada en la base de datos local' 
      }, { status: 404 });
    }

    logger.info('Pregunta respondida exitosamente', {
      questionId,
      userId,
    });

    return NextResponse.json({
      success: true,
      answer: answerData,
      question: updatedQuestion[0],
    });

  } catch (error) {
    logger.error('Error respondiendo pregunta', {
      questionId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
