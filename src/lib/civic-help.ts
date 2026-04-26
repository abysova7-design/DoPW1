export const CIVIC_CATEGORIES = [
  "ROADSIDE",
  "LOGISTICS",
  "EMERGENCY",
  "REPAIR",
  "OTHER",
] as const;

export type CivicCategory = (typeof CIVIC_CATEGORIES)[number];

export const CIVIC_CATEGORY_LABELS: Record<CivicCategory, string> = {
  ROADSIDE: "Помощь на дороге",
  LOGISTICS: "Логистика / доставка",
  EMERGENCY: "Аварийная ситуация",
  REPAIR: "Помощь с ремонтом",
  OTHER: "Прочее",
};

export function isCivicCategory(v: string): v is CivicCategory {
  return (CIVIC_CATEGORIES as readonly string[]).includes(v);
}
