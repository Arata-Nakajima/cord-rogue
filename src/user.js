// User data model (M1). No framework, no storage: plain data + validation.
// All processing is designed to run on the user's smartphone, on-device.

export const ORIENTATIONS = ["hetero", "homo", "bi", "poly"];

function randomName() {
  return "user-" + Math.random().toString(36).slice(2, 8);
}

/**
 * Create a user. id and displayName are auto-assigned random values,
 * as in the spec (2.1). measuredAt is the date of the latest GAS /
 * happiness measurement; appointments are disabled when it is
 * more than a year old.
 */
export function createUser(overrides = {}) {
  const user = {
    id: randomName(),
    displayName: randomName(),
    orientation: "hetero",
    nearestStation: "",
    gas: 50, // 50-100
    happiness: 0, // 0-100
    penalty: 0, // accumulated penalty points, reset at yearly renewal
    violationCount: 0, // confirmed rule violations; 3 means suspended
    gasCutoff: 50, // minimum GAS this user requires of a partner
    measuredAt: new Date().toISOString(),
    verified: false, // external-clinic MV verification (future phase)
    suspended: false,
    ...overrides,
  };
  validateUser(user);
  return user;
}

export function validateUser(user) {
  if (!ORIENTATIONS.includes(user.orientation)) {
    throw new Error(`invalid orientation: ${user.orientation}`);
  }
  if (!(user.gas >= 50 && user.gas <= 100)) {
    throw new Error(`gas out of range (50-100): ${user.gas}`);
  }
  if (!(user.happiness >= 0 && user.happiness <= 100)) {
    throw new Error(`happiness out of range (0-100): ${user.happiness}`);
  }
  if (!(user.gasCutoff >= 50 && user.gasCutoff <= 100)) {
    throw new Error(`gasCutoff out of range (50-100): ${user.gasCutoff}`);
  }
  if (Number.isNaN(Date.parse(user.measuredAt))) {
    throw new Error(`invalid measuredAt: ${user.measuredAt}`);
  }
  return true;
}

/** True when the yearly measurement renewal is overdue (>365 days). */
export function isMeasurementExpired(user, now = new Date()) {
  const ageMs = now.getTime() - Date.parse(user.measuredAt);
  return ageMs > 365 * 24 * 60 * 60 * 1000;
}

/** Appointment matching is disabled for suspended or expired users. */
export function canUseAppointments(user, now = new Date()) {
  return !user.suspended && !isMeasurementExpired(user, now);
}
