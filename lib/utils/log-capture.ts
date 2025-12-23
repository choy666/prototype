// Almacenar logs en memoria (solo para desarrollo)
const recentLogs: string[] = [];
const MAX_LOGS = 100;

export function captureLog(message: string) {
  const timestamp = new Date().toISOString();
  recentLogs.push(`[${timestamp}] ${message}`);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift();
  }
}

export function getRecentLogs() {
  return [...recentLogs];
}

export function clearLogs() {
  recentLogs.length = 0;
}

// Sobrescribir console.log para capturar logs específicos
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  const message = args.join(' ');
  if (message.includes('[Unified Shipping]') || message.includes('[Tiendanube]')) {
    captureLog(message);
  }
  originalLog.apply(console, args);
};
