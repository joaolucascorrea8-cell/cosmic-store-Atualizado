const VOLUME_KEY = "cosmic-notification-volume";

export const DEFAULT_NOTIFICATION_VOLUME = 0.85;

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
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : DEFAULT_NOTIFICATION_VOLUME;
}

export function setStoredNotificationVolume(volume: number) {
  if (typeof window === "undefined") return;
  const safe = Math.max(0, Math.min(1, volume));
  window.localStorage.setItem(VOLUME_KEY, String(safe));
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

export function playNotificationTone(variant: "customer" | "admin" | "preview" = "customer", volume = getStoredNotificationVolume()) {
  const context = getAudioContext();
  if (!context || context.state !== "running" || volume <= 0) return false;

  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  master.connect(compressor);
  compressor.connect(context.destination);

  const notes = variant === "admin"
    ? [740, 988, 1245]
    : variant === "preview"
      ? [784, 1047]
      : [660, 880, 1100];
  const peak = (variant === "admin" ? 0.5 : 0.44) * Math.max(0, Math.min(1, volume));
  const noteLength = variant === "admin" ? 0.16 : 0.14;
  const gap = variant === "admin" ? 0.115 : 0.105;

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * gap;
    const end = start + noteLength;
    oscillator.type = index % 2 === 0 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });

  return true;
}
