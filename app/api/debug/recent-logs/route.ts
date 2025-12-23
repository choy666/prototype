import { NextResponse } from 'next/server';

// Almacenar logs en memoria (solo para desarrollo)
const recentLogs: string[] = [];
const MAX_LOGS = 100;

// Función para capturar logs
export function captureLog(message: string) {
  const timestamp = new Date().toISOString();
  recentLogs.push(`[${timestamp}] ${message}`);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift();
  }
}

// Sobrescribir console.log para capturar logs específicos
const originalLog = console.log;
console.log = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('[Unified Shipping]') || message.includes('[Tiendanube]')) {
    captureLog(message);
  }
  originalLog.apply(console, args);
};

export async function GET() {
  return NextResponse.json({
    logs: recentLogs,
    count: recentLogs.length
  });
}

export async function DELETE() {
  recentLogs.length = 0;
  return NextResponse.json({ message: 'Logs cleared' });
}
