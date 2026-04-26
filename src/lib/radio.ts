export const RADIO_ROOM = "dispatch-main";

export type RadioParticipant = {
  userId: string;
  isTransmitting: boolean;
  lastHeartbeat: string;
  user: {
    id: string;
    nickname: string;
    displayName: string | null;
    isDispatcher: boolean;
    isAdmin: boolean;
  };
};

export type RadioSignal = {
  id: string;
  room: string;
  fromUserId: string;
  toUserId: string | null;
  type: "offer" | "answer" | "ice";
  payload: string;
  createdAt: string;
  consumedAt: string | null;
};

export function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
