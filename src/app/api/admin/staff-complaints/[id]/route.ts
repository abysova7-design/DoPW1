import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";

const STATUSES = new Set(["OPEN", "IN_REVIEW", "CLOSED"]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const adminNote =
    typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 4000) : undefined;

  const row = await prisma.staffComplaint.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const data: { status?: string; adminNote?: string | null } = {};
  if (status && STATUSES.has(status)) {
    data.status = status;
  }
  if (adminNote !== undefined) {
    data.adminNote = adminNote || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет изменений (status или adminNote)" }, { status: 400 });
  }

  const updated = await prisma.staffComplaint.update({
    where: { id },
    data,
  });

  return NextResponse.json({ complaint: updated });
}
