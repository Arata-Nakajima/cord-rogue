// Penalty rules (spec 2.2 / 3.3). Functions return a new user object.
// - No arrival/meeting proof: +1
// - Reschedule requested at least 30 minutes before start: 0,
//   but from the 3rd reschedule with the same partner onwards: +1
// - Confirmed rule violation: +1, and 3 violations means suspension
// - Penalties reset at the yearly measurement renewal

export function applyNoShow(user) {
  return { ...user, penalty: user.penalty + 1 };
}

export function applyReschedule(user, { minutesBeforeStart, samePartnerRescheduleCount }) {
  if (minutesBeforeStart >= 30 && samePartnerRescheduleCount < 3) {
    return { ...user };
  }
  return { ...user, penalty: user.penalty + 1 };
}

export function applyViolation(user) {
  const violationCount = user.violationCount + 1;
  return {
    ...user,
    penalty: user.penalty + 1,
    violationCount,
    suspended: violationCount >= 3,
  };
}

export function applyYearlyRenewal(user, measuredAt = new Date().toISOString()) {
  return { ...user, penalty: 0, measuredAt };
}
