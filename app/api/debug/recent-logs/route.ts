import { NextResponse } from 'next/server';
import { getRecentLogs, clearLogs } from '@/lib/utils/log-capture';

export async function GET() {
  return NextResponse.json({
    logs: getRecentLogs(),
    count: getRecentLogs().length
  });
}

export async function DELETE() {
  clearLogs();
  return NextResponse.json({ message: 'Logs cleared' });
}
