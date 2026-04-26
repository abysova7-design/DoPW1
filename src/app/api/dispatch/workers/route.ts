import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчеры" }, { status: 403 });
  }

  const activeShifts = await prisma.shift.findMany({
    where: { endedAt: null },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          displayName: true,
          positionRank: true,
          department: true,
          isDispatcher: true,
        },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  const workerIds = activeShifts.map((s) => s.userId);
  const lastPings = await Promise.all(
    workerIds.map((id) =>
      prisma.locationPing.findFirst({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );

  const pingMap = Object.fromEntries(
    workerIds.map((id, i) => [id, lastPings[i]]),
  );

  const workers = activeShifts.map((s) => ({
    shiftId: s.id,
    shiftStartedAt: s.startedAt,
    user: s.user,
    lastPing: pingMap[s.userId] ?? null,
  }));

  return NextResponse.json({ workers });
}
