/** Фиксированные точки разворота блок-постов (координаты карты портала 0…6000) */
export const PATROL_CHECKPOINTS = [
  { id: 1, label: "Блок-пост №1", lat: 1463, lng: 3049 },
  { id: 2, label: "Блок-пост №2", lat: 1792, lng: 3615 },
  { id: 3, label: "Блок-пост №3", lat: 286, lng: 1357 },
] as const;

export const ROAD_PATROL_XP_PER_ACTION = 5;

export const PATROL_REPORT_KINDS = {
  FUEL: "Заправка ТС",
  REPAIR: "Ремонт / техпомощь",
  BLOCKPOST_TEMP: "Временный блок-пост",
  BLOCKPOST_FIXED: "Заступление на стационарный блок-пост",
  ASSIST_EVAC: "Выезд на помощь эвакуации",
  REGISTRY_ENTRY: "Внесение ТС в базу",
  OTHER: "Иная помощь гражданам",
} as const;

export type PatrolReportKind = keyof typeof PATROL_REPORT_KINDS;

export function isPatrolReportKind(v: string): v is PatrolReportKind {
  return v in PATROL_REPORT_KINDS;
}
