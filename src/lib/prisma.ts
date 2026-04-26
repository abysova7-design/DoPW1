import { PrismaClient } from "@prisma/client";

const PRISMA_KEY = Symbol.for("dopw_prisma_v3");
type W = typeof globalThis & { [K in typeof PRISMA_KEY]?: PrismaClient };

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const w = globalThis as W;
if (!w[PRISMA_KEY]) w[PRISMA_KEY] = makePrisma();

export const prisma: PrismaClient = w[PRISMA_KEY]!;
