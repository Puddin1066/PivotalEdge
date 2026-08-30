/** Calibration helpers — identity for MVP. */
export function calibrateProbability(p: number, _bin?: string): number {
  return Math.min(0.95, Math.max(0.05, p));
}
