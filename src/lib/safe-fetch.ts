/** Безопасный парсинг JSON из Response — пустой/HTML ответ не ломает UI */
export async function safeJson<T = Record<string, unknown>>(
  res: Response,
  fallback: T = {} as T,
): Promise<T> {
  try {
    const text = await res.text();
    if (!text.trim()) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
