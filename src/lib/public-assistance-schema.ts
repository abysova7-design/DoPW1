import { prisma } from "@/lib/prisma";

/** Проверка, что в БД есть таблица обращений (после prisma db push). */
export async function publicAssistanceSchemaReady(): Promise<boolean> {
  try {
    await prisma.publicAssistanceRequest.findFirst({
      select: { id: true },
    });
    return true;
  } catch {
    return false;
  }
}
