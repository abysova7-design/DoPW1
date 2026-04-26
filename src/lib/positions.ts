export type PositionRank =
  | "TECHNICIAN"
  | "ENGINEER_I"
  | "ENGINEER_II"
  | "CHIEF_SPECIALIST"
  | "SUB_DIRECTOR"
  | "DIRECTOR";

export const RANK_LABELS: Record<PositionRank, string> = {
  TECHNICIAN: "Technician — техник",
  ENGINEER_I: "Engineer I — инженер I ступени",
  ENGINEER_II: "Engineer II — инженер II ступени",
  CHIEF_SPECIALIST: "Chief Specialist — главный специалист",
  SUB_DIRECTOR: "Sub director — заместитель департамента",
  DIRECTOR: "Director of Department — директор",
};

export const RANK_ORDER: PositionRank[] = [
  "TECHNICIAN",
  "ENGINEER_I",
  "ENGINEER_II",
  "CHIEF_SPECIALIST",
  "SUB_DIRECTOR",
  "DIRECTOR",
];

export const TASK_KIND_LABELS: Record<string, string> = {
  TOW_TRUCK: "Эвакуатор 🚛",
  SITE_INSPECTION: "Выездная инспекция 🔍",
  LOGISTICS_RUN: "Логистический рейс 📦",
  LAB_SAMPLE: "Забор проб / лаборатория 🧪",
  CONSTRUCTION_SUPPORT: "Сопровождение стройки 🏗️",
  CONSTRUCTION_SITE: "Строительство 👷",
  ADMIN_PAPERWORK: "Административная работа 📄",
};

export const ISSUER_RANKS: PositionRank[] = [
  "SUB_DIRECTOR",
  "DIRECTOR",
];

export function canIssueDiscipline(rank: PositionRank): boolean {
  return ISSUER_RANKS.includes(rank);
}

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.4));
}

export const EXAMINER_RANKS: PositionRank[] = [
  "CHIEF_SPECIALIST",
  "SUB_DIRECTOR",
  "DIRECTOR",
];

export function canExamine(rank: PositionRank): boolean {
  return EXAMINER_RANKS.includes(rank);
}

/** Просмотр заявок на работу / HR: заместители, директор, админ */
export function canManageJobApplications(
  rank: PositionRank,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  return rank === "SUB_DIRECTOR" || rank === "DIRECTOR";
}

export function addXp(currentXp: number, currentLevel: number, delta: number) {
  let xp = currentXp + delta;
  let level = currentLevel;
  let need = xpForLevel(level);
  while (xp >= need) {
    xp -= need;
    level += 1;
    need = xpForLevel(level);
  }
  return { xp, level };
}
