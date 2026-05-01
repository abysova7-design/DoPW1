import { NextResponse } from "next/server";
import type { PayoutRequestStatus } from "@prisma/client";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

const STATUSES: PayoutRequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "PAID"];

function statusRu(s: PayoutRequestStatus): string {
  switch (s) {
    case "PENDING":
      return "На рассмотрении";
    case "APPROVED":
      return "Одобрено";
    case "REJECTED":
      return "Отклонено";
    case "PAID":
      return "Выплачено";
    default:
      return s;
  }
}

export async function GET() {
  const user = await requireUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Только администратор" }, { status: 403 });

  const items = await prisma.payoutRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 80,
    include: {
      user: { select: { nickname: true, displayName: true, positionRank: true } },
    },
  });

  return NextResponse.json({ requests: items });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Только администратор" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const status = body?.status as PayoutRequestStatus;
  if (!id || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const adminNote =
    typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 2000) : null;
  const payoutDetails =
    typeof body?.payoutDetails === "string" ? body.payoutDetails.trim().slice(0, 2000) : null;

  const existing = await prisma.payoutRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const updated = await prisma.payoutRequest.update({
    where: { id },
    data: {
      status,
      ...(adminNote !== null ? { adminNote: adminNote || null } : {}),
      ...(payoutDetails !== null ? { payoutDetails: payoutDetails || null } : {}),
      ...(status === "PAID" || status === "REJECTED" ? { resolvedAt: new Date() } : {}),
    },
  });

  if (status !== existing.status) {
    await prisma.notification.create({
      data: {
        userId: existing.userId,
        type: NotificationType.PAYOUT_REQUEST,
        title: `💸 Заявка на выплату: ${statusRu(status)}`,
        body:
          [adminNote, payoutDetails].filter(Boolean).join("\n\n").trim() ||
          `Статус изменён на «${statusRu(status)}».`,
      },
    });
  }

  return NextResponse.json({ request: updated });
}
