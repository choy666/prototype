import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { getME2ValidationSummary } from '@/lib/validations/me2-products';

// Endpoint admin de solo lectura para diagnosticar compatibilidad ME2
// Devuelve un resumen agregado y el detalle por producto usando la lógica
// de validación centralizada en getME2ValidationSummary.
export async function GET(_request: NextRequest) {
  void _request;
  try {
    const session = await auth();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const summary = await getME2ValidationSummary();

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ME2] Error en endpoint admin de validación ME2:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
