// GAS scoring from face landmarks, fully on-device (spec 3.2).
// GAS = Golden ratio, Averageness, Symmetry.
//
// Input is a plain set of named 2D points in image coordinates
// (y grows downward), as produced by an on-device face landmark
// detector (ML Kit / MediaPipe). No image ever leaves the device;
// this module only receives numbers.
//
// Required points:
//   foreheadTop, chin, leftFaceEdge, rightFaceEdge,
//   leftEye, rightEye, noseTip, noseBaseLeft, noseBaseRight,
//   mouthLeft, mouthRight, leftCheek, rightCheek
//
// Scores are heuristic: the three subscores are 0-100, and GAS maps
// their mean onto the spec's 50-100 range. Calibration against the
// sample faces in the spec (50-100 reference faces) is future work,
// as is a population-average dataset for Averageness - the bundled
// AVERAGE_RATIOS below are tentative placeholders.

const PHI = 1.6180339887;

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

/** Golden ratio: key facial proportions close to phi score higher. */
export function goldenRatioScore(p) {
  const { width, height } = faceSize(p);
  const upperFace = dist(p.foreheadTop, p.noseTip);
  const lowerFace = dist(p.noseTip, p.chin);
  const mouthWidth = dist(p.mouthLeft, p.mouthRight);
  const noseWidth = dist(p.noseBaseLeft, p.noseBaseRight);
  const scores = [
    ratioScore(height / width, PHI),
    ratioScore(upperFace / lowerFace, 1), // equal thirds in this simplified model use nose as middle anchor
    ratioScore(mouthWidth / noseWidth, PHI),
  ];
  return scores.reduce((s, v) => s + v, 0) / scores.length;
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

// Tentative average-face ratios (placeholder, to be replaced by a
// measured dataset during calibration).
export const AVERAGE_RATIOS = {
  heightToWidth: 1.35,
  eyeGapToWidth: 0.36,
  noseWidthToWidth: 0.26,
  mouthWidthToWidth: 0.38,
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

/** Combined GAS in the spec's 50-100 range. */
export function scoreGAS(p) {
  const subscores = {
    symmetry: symmetryScore(p),
    goldenRatio: goldenRatioScore(p),
    averageness: averagenessScore(p),
  };
  const mean = (subscores.symmetry + subscores.goldenRatio + subscores.averageness) / 3;
  return { gas: Math.round((50 + mean / 2) * 10) / 10, subscores };
}
