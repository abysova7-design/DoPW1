import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const nickname = String(body?.nickname ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!nickname || !code) {
    return NextResponse.json({ error: "Ник и код обязательны" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { nickname } });
  if (!user) {
    return NextResponse.json({ error: "Неверный ник или код" }, { status: 401 });
  }
  const ok = await bcrypt.compare(code, user.codeHash);
  if (!ok) {
    return NextResponse.json({ error: "Неверный ник или код" }, { status: 401 });
  }

  const session = await getIronSession(await cookies(), sessionOptions);
  session.userId = user.id;
  session.nickname = user.nickname;
  session.isAdmin = user.isAdmin;
  await session.save();

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      isAdmin: user.isAdmin,
      positionRank: user.positionRank,
      department: user.department,
      displayName: user.displayName,
      xp: user.xp,
      level: user.level,
    },
  });
}
