const VOLUME_KEY = "cosmic-notification-volume";

export const DEFAULT_NOTIFICATION_VOLUME = 1;

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

export function getStoredNotificationVolume() {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_VOLUME;
  const saved = Number(window.localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(saved) && saved > 0 && saved <= 1 ? saved : DEFAULT_NOTIFICATION_VOLUME;
}

export function setStoredNotificationVolume(volume: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(1, volume))));
}

export async function unlockNotificationAudio() {
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function playNotificationTone(
  variant: "customer" | "admin" | "preview" = "customer",
  volume = DEFAULT_NOTIFICATION_VOLUME,
) {
  const context = getAudioContext();
  if (!context || context.state !== "running" || volume <= 0) return false;

  const now = context.currentTime;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 8;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.18;
  compressor.connect(context.destination);

  const master = context.createGain();
  master.gain.setValueAtTime(Math.min(1.15, Math.max(0.55, volume * 1.1)), now);
  master.connect(compressor);

  const notes = variant === "admin"
    ? [659.25, 880, 1174.66, 1318.51]
    : variant === "preview"
      ? [783.99, 1046.5, 1318.51]
      : [587.33, 783.99, 1046.5, 1174.66];

  notes.forEach((frequency, index) => {
    const start = now + index * 0.105;
    const end = start + 0.19;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index % 2 === 0 ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.32, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.03);
  });

  // Um segundo toque curto deixa o aviso perceptível mesmo em caixas de som pequenas.
  const accent = context.createOscillator();
  const accentGain = context.createGain();
  const accentStart = now + (variant === "preview" ? 0.30 : 0.43);
  accent.type = "triangle";
  accent.frequency.setValueAtTime(1567.98, accentStart);
  accentGain.gain.setValueAtTime(0.0001, accentStart);
  accentGain.gain.exponentialRampToValueAtTime(0.28, accentStart + 0.01);
  accentGain.gain.exponentialRampToValueAtTime(0.0001, accentStart + 0.16);
  accent.connect(accentGain);
  accentGain.connect(master);
  accent.start(accentStart);
  accent.stop(accentStart + 0.18);

  if (typeof navigator !== "undefined" && "vibrate" in navigator && variant !== "preview") {
    navigator.vibrate?.([70, 35, 70]);
  }
  return true;
}
