/**
 * Вставка и чтение заявок через $executeRaw, чтобы не зависеть от делегата
 * prisma.jobApplication, если npx prisma generate на Windows падает с EPERM.
 */
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type JobAppRow = {
  id: string;
  nickname: string;
  gameLevel: string;
  drugAddict: boolean;
  phone: string;
  engineeringEdu: boolean;
  educationLevel: string | null;
  driverLicense: boolean;
  licenseCategory: string | null;
  interviewAt: string;
  expectedIncome: number;
  createdAt: string;
};

type SqlRow = {
  id: string;
  nickname: string;
  gameLevel: string;
  drugAddict: boolean | number;
  phone: string;
  engineeringEdu: boolean | number;
  educationLevel: string | null;
  driverLicense: boolean | number;
  licenseCategory: string | null;
  interviewAt: Date | string;
  expectedIncome: number;
  createdAt: Date | string;
};

function asBool(v: boolean | number | bigint): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "bigint") return v !== BigInt(0);
  return v !== 0;
}

function asDateStr(d: Date | string): string {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") {
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? d : x.toISOString();
  }
  return String(d);
}

export async function insertJobApplicationInput(input: {
  nickname: string;
  gameLevel: string;
  drugAddict: boolean;
  phone: string;
  engineeringEdu: boolean;
  educationLevel: string | null;
  driverLicense: boolean;
  licenseCategory: string | null;
  interviewAt: Date;
  expectedIncome: number;
}): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const da = input.drugAddict ? 1 : 0;
  const en = input.engineeringEdu ? 1 : 0;
  const dr = input.driverLicense ? 1 : 0;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO JobApplication (
      id, nickname, gameLevel, drugAddict, phone, engineeringEdu, educationLevel,
      driverLicense, licenseCategory, interviewAt, expectedIncome, createdAt
    ) VALUES (
      ${id},
      ${input.nickname},
      ${input.gameLevel},
      ${da},
      ${input.phone},
      ${en},
      ${input.educationLevel},
      ${dr},
      ${input.licenseCategory},
      ${input.interviewAt},
      ${input.expectedIncome},
      ${now}
    )
  `);

  return id;
}

export async function listJobApplicationsSql(): Promise<JobAppRow[]> {
  const rows = await prisma.$queryRaw<SqlRow[]>(Prisma.sql`
    SELECT * FROM JobApplication ORDER BY createdAt DESC LIMIT 200
  `);
  return rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    gameLevel: r.gameLevel,
    drugAddict: asBool(r.drugAddict),
    phone: r.phone,
    engineeringEdu: asBool(r.engineeringEdu),
    educationLevel: r.educationLevel,
    driverLicense: asBool(r.driverLicense),
    licenseCategory: r.licenseCategory,
    interviewAt: asDateStr(r.interviewAt),
    expectedIncome: r.expectedIncome,
    createdAt: asDateStr(r.createdAt),
  }));
}
