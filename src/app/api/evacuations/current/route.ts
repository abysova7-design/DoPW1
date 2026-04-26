import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const task = await prisma.workTask.findFirst({
    where: {
      userId: user.id,
      endedAt: null,
      kind: "TOW_TRUCK",
    },
    include: { evacuation: true },
  });

  return NextResponse.json({
    task,
    evacuation: task?.evacuation ?? null,
  });
}
