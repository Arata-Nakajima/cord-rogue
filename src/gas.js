// GAS scoring from face landmarks, fully on-device (spec 3.2).
//
// v2 (2026-11-25): weights and targets revised to follow the
// published evidence instead of equal weighting - see
// docs/GAS_REFERENCES.md for the full report. Summary:
// - Averageness has the strongest support (Rhodes 2006 meta-analysis,
//   R about 0.52 manipulated / 0.40 real faces) -> weight 0.60
// - Symmetry has a real but small effect (R about 0.25) -> weight 0.25
// - The classic golden ratio (phi) has no convincing support
//   (Kiekens et al. 2008; Londono et al. 2024 systematic review:
//   no significant association) -> weight 0, removed from the score
// - In its place, Pallett, Link & Lee (2010) published optimal
//   ratios derived from average faces -> weight 0.15
// Sexual dimorphism (15-25% in the report's synthesis) is not yet
// implemented; it needs sex-matched reference data.
//
// Input is a plain set of named 2D points in image coordinates
// (y grows downward) from an on-device landmark detector
// (e.g., MediaPipe Face Landmarker, Apache-2.0). No image ever
// leaves the device; this module only receives numbers.
//
// Required points:
//   foreheadTop, chin, leftFaceEdge, rightFaceEdge,
//   leftEye, rightEye (eye centres), noseTip, noseBaseLeft,
//   noseBaseRight, mouthLeft, mouthRight, leftCheek, rightCheek

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/** How close a ratio is to a target, as 0-100. */
function ratioScore(ratio, target) {
  return 100 * clamp01(1 - Math.abs(ratio - target) / target);
}

export function faceSize(p) {
  return {
    width: dist(p.leftFaceEdge, p.rightFaceEdge),
    height: dist(p.foreheadTop, p.chin),
  };
}

/** Symmetry: mirrored pairs should sit evenly around the face midline. */
export function symmetryScore(p) {
  const { width, height } = faceSize(p);
  const midX = (p.noseTip.x + p.chin.x) / 2;
  const pairs = [
    [p.leftEye, p.rightEye],
    [p.leftCheek, p.rightCheek],
    [p.mouthLeft, p.mouthRight],
    [p.noseBaseLeft, p.noseBaseRight],
  ];
  let error = 0;
  for (const [left, right] of pairs) {
    const dxAsym = Math.abs(Math.abs(left.x - midX) - Math.abs(right.x - midX)) / width;
    const dyAsym = Math.abs(left.y - right.y) / height;
    error += dxAsym + dyAsym;
  }
  const meanError = error / pairs.length;
  return 100 * clamp01(1 - meanError * 4);
}

/** Facial ratios used for Averageness (distance from the average face). */
export function facialRatios(p) {
  const { width, height } = faceSize(p);
  return {
    heightToWidth: height / width,
    eyeGapToWidth: dist(p.leftEye, p.rightEye) / width,
    noseWidthToWidth: dist(p.noseBaseLeft, p.noseBaseRight) / width,
    mouthWidthToWidth: dist(p.mouthLeft, p.mouthRight) / width,
    upperToLower: dist(p.foreheadTop, p.noseTip) / dist(p.noseTip, p.chin),
  };
}

// Average-face target ratios. Sources (see GAS_REFERENCES.md):
// - heightToWidth 1.35, noseWidthToWidth 0.25, mouthWidthToWidth 0.39:
//   Farkas (1994) North American White young-adult norms
//   (tr-gn / zy-zy = 1.35 M / 1.33 F; al-al / zy-zy = 0.25/0.24;
//   ch-ch / zy-zy = 0.39)
// - eyeGapToWidth 0.46: Pallett et al. (2010) optimal interocular
//   ratio (eye centres, not inner canthi)
// - upperToLower 1.0: equal upper/lower split at the nose tip anchor
// Caveat: these are North American White norms. Farkas et al. (2005)
// found Japanese faces significantly wider with wider noses, so a
// Japanese-matched average (e.g., Ogawa et al. 2015) should replace
// these when its values become available.
export const AVERAGE_RATIOS = {
  heightToWidth: 1.35,
  eyeGapToWidth: 0.46,
  noseWidthToWidth: 0.25,
  mouthWidthToWidth: 0.39,
  upperToLower: 1.0,
};

/** Averageness: closeness of the user's ratios to the average face. */
export function averagenessScore(p, average = AVERAGE_RATIOS) {
  const ratios = facialRatios(p);
  const keys = Object.keys(average);
  let error = 0;
  for (const k of keys) {
    error += Math.abs(ratios[k] - average[k]) / average[k];
  }
  return 100 * clamp01(1 - (error / keys.length) * 2);
}

/**
 * Pallett, Link & Lee (2010) optimal ratios:
 * eye-mouth distance = 36% of face length, interocular distance =
 * 46% of face width (Caucasian female faces; use with that caveat).
 */
export function pallettRatioScore(p) {
  const { width, height } = faceSize(p);
  const eyeY = (p.leftEye.y + p.rightEye.y) / 2;
  const mouthY = (p.mouthLeft.y + p.mouthRight.y) / 2;
  const eyeMouth = (mouthY - eyeY) / height;
  const interocular = dist(p.leftEye, p.rightEye) / width;
  return (ratioScore(eyeMouth, 0.36) + ratioScore(interocular, 0.46)) / 2;
}

export const GAS_WEIGHTS = { averageness: 0.6, symmetry: 0.25, pallettRatios: 0.15 };

/** Combined GAS in the spec's 50-100 range. */
export function scoreGAS(p) {
  const subscores = {
    averageness: averagenessScore(p),
    symmetry: symmetryScore(p),
    pallettRatios: pallettRatioScore(p),
  };
  const weighted =
    GAS_WEIGHTS.averageness * subscores.averageness +
    GAS_WEIGHTS.symmetry * subscores.symmetry +
    GAS_WEIGHTS.pallettRatios * subscores.pallettRatios;
  return { gas: Math.round((50 + weighted / 2) * 10) / 10, subscores, weights: GAS_WEIGHTS };
}
