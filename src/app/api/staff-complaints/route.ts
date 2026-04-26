import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function parseEvidenceUrls(raw: unknown): string {
  if (!Array.isArray(raw)) return "[]";
  const out: string[] = [];
  for (const x of raw.slice(0, 12)) {
    const s = typeof x === "string" ? x.trim() : "";
    if (!s || s.length > 600) continue;
    if (!/^https?:\/\//i.test(s)) continue;
    out.push(s);
  }
  return JSON.stringify(out);
}

/** Публичная отправка жалобы (без авторизации). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const reporterName = String(body?.reporterName ?? "").trim();
  const violatorName = String(body?.violatorName ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const evidenceUrls = parseEvidenceUrls(body?.evidenceUrls);

  if (!reporterName || reporterName.length > 120) {
    return NextResponse.json({ error: "Укажите ваше имя (до 120 символов)" }, { status: 400 });
  }
  if (!violatorName || violatorName.length > 120) {
    return NextResponse.json({ error: "Укажите ник или имя нарушителя" }, { status: 400 });
  }
  if (!description || description.length < 15 || description.length > 8000) {
    return NextResponse.json(
      { error: "Опишите ситуацию подробнее (от 15 до 8000 символов)" },
      { status: 400 },
    );
  }
  if (!phone || phone.length > 40) {
    return NextResponse.json({ error: "Укажите контактный телефон или Discord" }, { status: 400 });
  }

  const row = await prisma.staffComplaint.create({
    data: {
      reporterName,
      violatorName,
      description,
      phone,
      evidenceUrls,
      status: "OPEN",
    },
  });

  const staff = await prisma.user.findMany({
    where: { OR: [{ isDispatcher: true }, { isAdmin: true }] },
    select: { id: true },
  });

  const title = `📛 Жалоба на сотрудника`;
  const notifBody = `От: ${reporterName} · На: ${violatorName} · ${phone}\n${description.slice(0, 400)}${description.length > 400 ? "…" : ""}`;

  if (staff.length > 0) {
    try {
      await prisma.notification.createMany({
        data: staff.map((u) => ({
          userId: u.id,
          type: NotificationType.STAFF_COMPLAINT,
          title,
          body: notifBody,
        })),
      });
    } catch (e) {
      console.error("[staff-complaints] notifications", e);
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
