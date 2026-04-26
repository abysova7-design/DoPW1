/** Фиксированные точки разворота блок-постов (координаты карты портала 0…6000) */
export const PATROL_CHECKPOINTS = [
  { id: 1, label: "Блок-пост №1", lat: 1463, lng: 3049 },
  { id: 2, label: "Блок-пост №2", lat: 1792, lng: 3615 },
  { id: 3, label: "Блок-пост №3", lat: 286, lng: 1357 },
] as const;

export function stationaryCheckpointById(id: number) {
  return PATROL_CHECKPOINTS.find((c) => c.id === id);
}

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

/** Статусы отчёта в БД → подпись в интерфейсе */
export const PATROL_REPORT_STATUS_RU: Record<string, string> = {
  PENDING: "На проверке",
  NEEDS_WORK: "На доработке",
  APPROVED: "Принят",
};

/** Подсказки к полю «что сделали (RP)» по типу отчёта */
export const PATROL_REPORT_KIND_HINTS: Record<PatrolReportKind, string> = {
  FUEL: "ТС, объём топлива, способ оплаты, что сделали по RP…",
  REPAIR: "Что неисправно, что отремонтировали / какая техпомощь, итог…",
  BLOCKPOST_TEMP: "Где стоите, осмотр ТС, нарушения, что зафиксировали… (временный КП отметьте кнопкой на карте)",
  BLOCKPOST_FIXED: "На каком стационарном КП, что проверили, итог смены на посту…",
  ASSIST_EVAC: "Кому помогли эвакуации, что делали на месте, координация…",
  REGISTRY_ENTRY: "Данные внесены через форму «Внесение ТС».",
  OTHER: "Суть обращения гражданина, что сделали, итог…",
};
