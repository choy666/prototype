
export function safeToLocaleString(date: string | Date | null | undefined, fallback = 'Fecha inválida'): string {
    if (!date) {
      return fallback;
    }
  
    const d = new Date(date);
  
    if (isNaN(d.getTime())) {
      return fallback;
    }
  
    return d.toLocaleString();
  }
  