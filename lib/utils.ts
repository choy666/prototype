//li/utils
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Convierte atributos de array de objetos a objeto plano
 * @param attributes - Atributos que pueden ser array o objeto plano
 * @returns Objeto plano con los atributos convertidos
 */
export function convertAttributesToObject(attributes: unknown): Record<string, string> {
  if (Array.isArray(attributes)) {
    const result: Record<string, string> = {};
    attributes.forEach((attr: unknown) => {
      if (typeof attr === 'object' && attr !== null && 'name' in attr && 'values' in attr) {
        const { name, values } = attr as { name?: string; values?: unknown };
        if (typeof name === 'string' && Array.isArray(values) && values.length > 0 && typeof values[0] === 'string') {
          result[name] = values[0];
        }
      }
    });
    return result;
  } else if (typeof attributes === 'object' && attributes !== null) {
    return attributes as Record<string, string>;
  }
  return {};
}
