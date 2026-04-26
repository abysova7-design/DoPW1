import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { slug } = await ctx.params;

  const channel = await prisma.channel.findUnique({
    where: { slug },
    include: {
      posts: {
        orderBy: { createdAt: "desc" },
        take: 60,
        include: {
          author: { select: { nickname: true, displayName: true } },
        },
      },
    },
  });

  if (!channel) return NextResponse.json({ error: "Канал не найден" }, { status: 404 });

  return NextResponse.json({ channel });
}
