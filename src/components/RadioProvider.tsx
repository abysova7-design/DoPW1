"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RADIO_ROOM, safeParse, type RadioParticipant, type RadioSignal } from "@/lib/radio";

type Me = {
  id: string;
  nickname: string;
  displayName: string | null;
  isDispatcher: boolean;
  isAdmin: boolean;
} | null;

type RadioContextValue = {
  me: Me;
  participants: RadioParticipant[];
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  transmitting: boolean;
  setTransmitting: (v: boolean) => void;
  micError: string | null;
  connectedCount: number;
  requestMicPermission: () => Promise<boolean>;
};

const RadioContext = createContext<RadioContextValue | null>(null);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function RadioProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me>(null);
  const [participants, setParticipants] = useState<RadioParticipant[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [transmitting, setTransmittingState] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const afterMsRef = useRef(0);
  const joiningRef = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setMe(d.user ?? null))
      .catch(() => setMe(null));
  }, []);

  const closePeer = useCallback((userId: string) => {
    const pc = pcsRef.current.get(userId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcsRef.current.delete(userId);
    }
    const el = audioElsRef.current.get(userId);
    if (el) {
      el.pause();
      el.srcObject = null;
      audioElsRef.current.delete(userId);
    }
  }, []);

  const ensureMic = useCallback(async () => {
    if (!window.isSecureContext) {
      setMicError("Микрофон доступен только по HTTPS (или localhost).");
      return null;
    }
    if (streamRef.current) return streamRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
        video: false,
      });
      s.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      streamRef.current = s;
      setMicError(null);
      return s;
    } catch (e) {
      const err = e as DOMException | undefined;
      if (err?.name === "NotAllowedError") {
        setMicError("Доступ к микрофону запрещён в браузере для этого сайта.");
      } else if (err?.name === "NotFoundError") {
        setMicError("Микрофон не найден на устройстве.");
      } else {
        setMicError("Нет доступа к микрофону.");
      }
      return null;
    }
  }, []);

  const requestMicPermission = useCallback(async () => {
    const s = await ensureMic();
    return Boolean(s);
  }, [ensureMic]);

  const publishSignal = useCallback(
    async (toUserId: string, type: "offer" | "answer" | "ice", payload: unknown) => {
      if (!enabled) return;
      await fetch("/api/radio/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: RADIO_ROOM,
          toUserId,
          type,
          payload,
        }),
      }).catch(() => null);
    },
    [enabled],
  );

  const ensurePeer = useCallback(
    async (peerUserId: string, initiator: boolean) => {
      if (!me || peerUserId === me.id) return null;
      const existing = pcsRef.current.get(peerUserId);
      if (existing) return existing;
      const localStream = await ensureMic();
      if (!localStream) return null;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          publishSignal(peerUserId, "ice", e.candidate.toJSON());
        }
      };
      pc.onconnectionstatechange = () => {
        const connected = [...pcsRef.current.values()].filter(
          (p) => p.connectionState === "connected" || p.connectionState === "connecting",
        ).length;
        setConnectedCount(connected);
      };
      pc.ontrack = (ev) => {
        let el = audioElsRef.current.get(peerUserId);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          el.playsInline = true;
          audioElsRef.current.set(peerUserId, el);
        }
        el.srcObject = ev.streams[0];
        void el.play().catch(() => null);
      };
      pcsRef.current.set(peerUserId, pc);

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await publishSignal(peerUserId, "offer", offer);
      }
      return pc;
    },
    [ensureMic, me, publishSignal],
  );

  const consumeSignals = useCallback(async () => {
    if (!enabled || !me) return;
    const r = await fetch(
      `/api/radio/signals?room=${encodeURIComponent(RADIO_ROOM)}&afterMs=${afterMsRef.current}`,
      { cache: "no-store" },
    ).catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => ({}));
    const signals = (d.signals ?? []) as RadioSignal[];
    if (signals.length === 0) return;

    const consumedIds: string[] = [];
    for (const s of signals) {
      afterMsRef.current = Math.max(afterMsRef.current, new Date(s.createdAt).getTime());
      if (s.fromUserId === me.id) continue;
      const payload = safeParse<RTCSessionDescriptionInit | RTCIceCandidateInit>(s.payload, {});
      if (s.type === "offer") {
        const pc = await ensurePeer(s.fromUserId, false);
        if (!pc) continue;
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await publishSignal(s.fromUserId, "answer", answer);
      } else if (s.type === "answer") {
        const pc = pcsRef.current.get(s.fromUserId);
        if (pc) {
          await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        }
      } else if (s.type === "ice") {
        const pc = pcsRef.current.get(s.fromUserId) ?? (await ensurePeer(s.fromUserId, false));
        if (pc) {
          await pc.addIceCandidate(payload as RTCIceCandidateInit).catch(() => null);
        }
      }
      consumedIds.push(s.id);
    }

    if (consumedIds.length > 0) {
      await fetch("/api/radio/signals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: consumedIds }),
      }).catch(() => null);
    }
  }, [enabled, ensurePeer, me, publishSignal]);

  const refreshParticipants = useCallback(async () => {
    if (!enabled || !me) return;
    const r = await fetch(`/api/radio/session?room=${encodeURIComponent(RADIO_ROOM)}`, {
      cache: "no-store",
    }).catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => ({}));
    const next = (d.participants ?? []) as RadioParticipant[];
    setParticipants(next);

    const ids = new Set(next.map((p) => p.userId).filter((id) => id !== me.id));
    for (const [peerId] of pcsRef.current) {
      if (!ids.has(peerId)) closePeer(peerId);
    }
    for (const p of next) {
      if (p.userId === me.id) continue;
      const initiator = me.id < p.userId;
      await ensurePeer(p.userId, initiator);
    }
  }, [closePeer, enabled, ensurePeer, me]);

  useEffect(() => {
    if (!enabled || !me || joiningRef.current) return;
    joiningRef.current = true;
    fetch("/api/radio/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: RADIO_ROOM }),
    })
      .then(() => refreshParticipants())
      .finally(() => {
        joiningRef.current = false;
      });

    const t1 = setInterval(() => {
      void fetch("/api/radio/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: RADIO_ROOM,
          isTransmitting: transmitting,
        }),
      }).catch(() => null);
    }, 5000);
    const t2 = setInterval(() => void refreshParticipants(), 3000);
    const t3 = setInterval(() => void consumeSignals(), 1200);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, [consumeSignals, enabled, me, refreshParticipants, transmitting]);

  useEffect(() => {
    if (!enabled) {
      void fetch(`/api/radio/session?room=${encodeURIComponent(RADIO_ROOM)}`, {
        method: "DELETE",
      }).catch(() => null);
      for (const [peerId] of pcsRef.current) closePeer(peerId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setParticipants([]);
      setTransmittingState(false);
      setConnectedCount(0);
    }
  }, [closePeer, enabled]);

  useEffect(() => {
    function onUnload() {
      void fetch(`/api/radio/session?room=${encodeURIComponent(RADIO_ROOM)}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => null);
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const setTransmitting = useCallback((value: boolean) => {
    setTransmittingState(value);
    const s = streamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => {
      t.enabled = value;
    });
  }, []);

  const value = useMemo<RadioContextValue>(
    () => ({
      me,
      participants,
      enabled,
      setEnabled,
      transmitting,
      setTransmitting,
      micError,
      connectedCount,
      requestMicPermission,
    }),
    [
      connectedCount,
      enabled,
      me,
      micError,
      participants,
      requestMicPermission,
      setTransmitting,
      transmitting,
    ],
  );

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) {
    throw new Error("useRadio must be used within RadioProvider");
  }
  return ctx;
}
