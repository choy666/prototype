import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/actions/auth';
import { callMcpTool } from '@/lib/mcp/client';
import { logger } from '@/lib/utils/logger';

const requestSchema = z.object({
  server: z.enum(['mercadolibre', 'mercadopago']),
  tool: z.string().min(1, 'La herramienta es obligatoria'),
  args: z.record(z.string(), z.any()).optional(),
  timeoutMs: z.number().min(1000).max(60000).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let parsedBody;
  try {
    parsedBody = requestSchema.safeParse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Payload inválido',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: 'Parámetros inválidos',
        details: parsedBody.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { server, tool, args, timeoutMs } = parsedBody.data;

  try {
    const result = await callMcpTool({
      server,
      tool,
      args,
      timeoutMs,
    });

    logger.info('MCP diagnostic ejecutado correctamente', {
      server,
      tool,
      durationMs: result.durationMs,
      truncated: result.truncated,
      userId: session.user.id,
    });

    return NextResponse.json({
      server,
      tool,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('MCP diagnostic falló', {
      server,
      tool,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'No se pudo ejecutar la herramienta MCP',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
