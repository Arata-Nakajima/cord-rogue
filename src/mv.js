// Market Value (MV) calculation (spec 3.2).
// MV = alpha * GAS + beta * happiness - penalty
// v0: alpha = beta = 0.5 (fixed). Learning alpha/beta from follow-up
// data to maximise total happiness is a future phase.
// GAS is 50-100 while happiness is 0-100, so happiness is linearly
// normalised to 50-100 before combining (tentative, see design memo).

export const ALPHA = 0.5;
export const BETA = 0.5;

export function normalizeHappiness(happiness) {
  return 50 + happiness / 2;
}

export function calculateMV(user, { alpha = ALPHA, beta = BETA } = {}) {
  const mv = alpha * user.gas + beta * normalizeHappiness(user.happiness) - user.penalty;
  return Math.round(mv * 100) / 100;
}
