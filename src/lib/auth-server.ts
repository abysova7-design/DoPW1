import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "./session";
import { prisma } from "./prisma";

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user?.isAdmin) return null;
  return user;
}
