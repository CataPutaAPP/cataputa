/* ─── Notification sounds + message validation ──────────────────────── */

const AudioCtx = typeof window !== "undefined" ? window.AudioContext || (window as any).webkitAudioContext : null;
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

/** Play a short notification beep */
export function playNotificationSound(type: "proposal" | "accepted" | "message" = "proposal") {
  const ctx = getAudioCtx();
  if (!ctx) return;

  try {
    ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "proposal") {
      // Two-tone rising chime
      osc.frequency.setValueAtTime(587, ctx.currentTime);       // D5
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.15); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === "accepted") {
      // Three-tone celebration
      osc.frequency.setValueAtTime(523, ctx.currentTime);       // C5
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12); // E5
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      // Simple ping
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio not supported or blocked
  }
}

/** Validate message: block phone numbers and URLs */
export function validateMessage(text: string): { valid: boolean; error: string | null } {
  if (!text || text.trim() === "") return { valid: true, error: null };

  // Phone patterns
  const phonePatterns = [
    /\d{9,}/,                          // 9+ digits in a row
    /\(\d{2}\)\s*\d{4,5}[- ]?\d{4}/,  // (11) 99999-0000
    /\+\d{2}\s*\d/,                    // +55 ...
    /\d{4,5}[- ]\d{4}/,               // 99999-0000
  ];

  for (const p of phonePatterns) {
    if (p.test(text.replace(/\s/g, ""))) {
      return { valid: false, error: "Não é permitido enviar números de telefone." };
    }
  }

  // URL patterns
  const urlPatterns = [
    /https?:\/\//i,
    /www\./i,
    /\.[a-z]{2,4}\//i,
    /\.com/i,
    /\.br/i,
    /\.net/i,
    /\.org/i,
    /\.io/i,
  ];

  for (const p of urlPatterns) {
    if (p.test(text)) {
      return { valid: false, error: "Não é permitido enviar links ou URLs." };
    }
  }

  return { valid: true, error: null };
}
