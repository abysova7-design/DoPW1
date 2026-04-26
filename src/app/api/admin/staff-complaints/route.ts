import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const complaints = await prisma.staffComplaint.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return NextResponse.json({ complaints });
}
