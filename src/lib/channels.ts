import { prisma } from "./prisma";

export async function postToChannel(
  slug: string,
  title: string,
  body: string,
  emoji?: string,
  authorId?: string,
) {
  const ch = await prisma.channel.findUnique({ where: { slug } });
  if (!ch) return;
  await prisma.channelPost.create({
    data: {
      channelId: ch.id,
      title,
      body,
      emoji: emoji ?? null,
      authorId: authorId ?? null,
    },
  });
}

export async function postOrder(
  title: string,
  body: string,
  emoji = "📋",
  authorId?: string,
) {
  return postToChannel("orders", title, body, emoji, authorId);
}

export async function postAttestation(
  title: string,
  body: string,
  passed: boolean,
  authorId?: string,
) {
  return postToChannel(
    "attestations",
    title,
    body,
    passed ? "✅" : "❌",
    authorId,
  );
}
