import confetti from 'canvas-confetti';

export function fireConfetti(element) {
  if (!element) {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#04D9FF', '#a855f7', '#10b981', '#f43f5e'],
      disableForReducedMotion: true,
    });
    return;
  }

  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  confetti({
    particleCount: 80,
    spread: 60,
    origin: { x, y },
    colors: ['#04D9FF', '#a855f7', '#10b981', '#f43f5e'],
    disableForReducedMotion: true,
  });
}

export default function ConfettiCanvas() {
  return null;
}
