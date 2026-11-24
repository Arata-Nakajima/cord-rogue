// Appointment adjustment + meeting flow (spec 2.2 / 3.3).
// Pure logic: place/time decision, arrival proof substitute,
// date consent, and rule-violation report evaluation.

import { applyNoShow, applyViolation } from "./penalty.js";

/**
 * Decide the place: minimise the sum of both users' ranks
 * (rank = index in each user's preference list, lower is better).
 * candidates: [{ placeId, rankByA, rankByB }]
 */
export function decidePlace(candidates) {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => a.rankByA + a.rankByB - (b.rankByA + b.rankByB))[0].placeId;
}

/** First time slot both users are free, in chronological order. */
export function decideTime(freeA, freeB) {
  const setB = new Set(freeB);
  return freeA.filter((t) => setB.has(t)).sort()[0] ?? null;
}

export function createAppointment(userAId, userBId, candidates, freeA, freeB) {
  const placeId = decidePlace(candidates);
  const startsAt = decideTime(freeA, freeB);
  if (!placeId || !startsAt) return { status: "no_common_slot", userAId, userBId };
  return {
    id: `appt-${userAId}-${userBId}`,
    userAId, userBId, placeId, startsAt,
    status: "decided", // decided -> met | no_show
    arrivedA: false, arrivedB: false,
    dateConsentA: null, dateConsentB: null, // null until asked after meeting
    rescheduleCountByPair: 0,
  };
}

export function markArrived(appt, who) {
  return { ...appt, [who === "A" ? "arrivedA" : "arrivedB"]: true };
}

/** Meeting is proven when both arrived (QR/GPS proof replaces this later). */
export function isMeetingProven(appt) {
  return appt.arrivedA && appt.arrivedB;
}

/**
 * Close an appointment after its start time.
 * Returns { appointment, penalized: ['A'|'B', ...] } - a side with no
 * arrival proof gets a no-show penalty (applied by the caller).
 */
export function closeAppointment(appt) {
  if (isMeetingProven(appt)) return { appointment: { ...appt, status: "met" }, penalized: [] };
  const penalized = [];
  if (!appt.arrivedA) penalized.push("A");
  if (!appt.arrivedB) penalized.push("B");
  return { appointment: { ...appt, status: "no_show" }, penalized };
}

export function penalizeNoShows(appt, userA, userB) {
  const { penalized } = closeAppointment(appt);
  return {
    userA: penalized.includes("A") ? applyNoShow(userA) : userA,
    userB: penalized.includes("B") ? applyNoShow(userB) : userB,
  };
}

/** After a proven meeting, ask both whether to proceed to a date. */
export function recordDateConsent(appt, who, consent) {
  if (!isMeetingProven(appt)) throw new Error("meeting not proven yet");
  return { ...appt, [who === "A" ? "dateConsentA" : "dateConsentB"]: consent };
}

export function dateAgreed(appt) {
  return appt.dateConsentA === true && appt.dateConsentB === true;
}

/**
 * Rule-violation report (spec 2.2): valid only when the reporter
 * refused the date and the other side still pursued contact.
 * A report after mutual consent is invalid.
 */
export function evaluateReport(appt, reporter) {
  if (dateAgreed(appt)) return { valid: false, reason: "after_consent" };
  const reporterConsent = reporter === "A" ? appt.dateConsentA : appt.dateConsentB;
  if (reporterConsent !== false) return { valid: false, reason: "reporter_did_not_refuse" };
  return { valid: true };
}

export function applyReport(appt, reporter, targetUser) {
  const result = evaluateReport(appt, reporter);
  if (!result.valid) return { applied: false, reason: result.reason, user: targetUser };
  return { applied: true, user: applyViolation(targetUser) };
}
