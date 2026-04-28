/** Нормализация госномера для сравнения (без пробелов, верхний регистр). */
export function normalizePlateInput(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}
