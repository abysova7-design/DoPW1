/**
 * Система звуков портала ДОР.
 * MP3-файлы лежат в /public/.
 * Все вызовы безопасны — никогда не бросают исключений.
 */

type SoundKey =
  | "notification"
  | "dispatch"
  | "alert"
  | "success"
  | "ping"
  | "exam"
  | "interview";

const FILE_MAP: Record<SoundKey, string> = {
  /** Новое уведомление (любого типа) */
  notification: "/uvedomlenie.mp3",
  /** Новый вызов диспетчера */
  dispatch: "/newvizov.mp3",
  /** Вызов на базу / alert */
  alert: "/newvizov.mp3",
  /** Успешное завершение */
  success: "/uvedomlenie.mp3",
  /** Пора отметить позицию на карте */
  ping: "/10minalert.mp3",
  /** Новая запись на экзамен */
  exam: "/ekz.mp3",
  /** Новая заявка на собеседование */
  interview: "/sobes.mp3",
};

/** Кэш Audio-объектов чтобы не создавать новый на каждый звук */
const cache: Partial<Record<SoundKey, HTMLAudioElement>> = {};

export function playSound(kind: SoundKey = "notification") {
  if (typeof window === "undefined") return;

  try {
    // Переиспользуем или создаём Audio
    let audio = cache[kind];
    if (!audio) {
      audio = new Audio(FILE_MAP[kind]);
      audio.volume = 0.85;
      cache[kind] = audio;
    }

    // Если уже играет — перемотаем в начало
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Браузер заблокировал без жеста пользователя — тихо игнорируем
    });
  } catch {
    // Fallback: синтетический звук через Web Audio API
    _syntheticBeep(kind);
  }
}

/** Запасной синтетический звук если Audio API недоступен */
function _syntheticBeep(kind: SoundKey) {
  try {
    const ctx = new AudioContext();
    const play = (freq: number, start: number, dur: number, vol = 0.2) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    if (kind === "dispatch" || kind === "alert") {
      play(660, 0, 0.08); play(880, 0.1, 0.08); play(1100, 0.2, 0.15);
    } else if (kind === "ping") {
      play(440, 0, 0.2); play(550, 0.25, 0.2); play(660, 0.5, 0.25);
    } else if (kind === "exam" || kind === "interview") {
      play(880, 0, 0.1); play(1100, 0.12, 0.1); play(1320, 0.24, 0.2);
    } else {
      play(880, 0, 0.12); play(1100, 0.14, 0.12);
    }
  } catch { /* silent */ }
}
