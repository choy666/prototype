// lib/utils/warning-cache.ts
// Cache para evitar logs redundantes del mismo error

interface WarningEntry {
  timestamp: number;
  count: number;
  lastLogged: number;
}

class WarningCache {
  private cache = new Map<string, WarningEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutos
  private readonly LOG_INTERVAL = 60 * 1000; // 1 minuto entre logs del mismo error

  shouldLog(key: string): boolean {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      // Primer vez que vemos este error
      this.cache.set(key, {
        timestamp: now,
        count: 1,
        lastLogged: now
      });
      return true;
    }

    // Actualizar contador
    entry.count++;

    // Si expiró TTL, reiniciar
    if (now - entry.timestamp > this.TTL) {
      this.cache.set(key, {
        timestamp: now,
        count: 1,
        lastLogged: now
      });
      return true;
    }

    // Si pasó suficiente tiempo desde el último log, permitir loggear
    if (now - entry.lastLogged > this.LOG_INTERVAL) {
      entry.lastLogged = now;
      return true;
    }

    // No loggear para evitar spam
    return false;
  }

  getStats(key: string): WarningEntry | undefined {
    return this.cache.get(key);
  }

  // Limpiar entradas antiguas
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton
export const warningCache = new WarningCache();

// Limpiar cache cada 5 minutos
setInterval(() => warningCache.cleanup(), 5 * 60 * 1000);
