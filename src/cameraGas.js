// Camera image -> GAS score, fully on-device.
//
// Pipeline: photo -> face landmark detector (MediaPipe Face
// Landmarker, Apache-2.0, runs on the phone) -> this module picks
// the points src/gas.js needs -> scoreGAS(). The photo itself is
// never stored or sent anywhere by this code; only numbers move.
//
// Why MediaPipe and not ML Kit: ML Kit's face landmarks do not
// include the nose-base width points, which the Averageness ratios
// require. MediaPipe gives 478 points, more than enough.
//
// Detector output is normalised coordinates (0-1), so the real
// image width/height are required to restore true geometry
// (x and y are scaled by different factors otherwise).

import { scoreGAS, faceSize } from "./gas.js";

export const REQUIRED_POINTS = [
  "foreheadTop", "chin", "leftFaceEdge", "rightFaceEdge",
  "leftEye", "rightEye", "noseTip", "noseBaseLeft", "noseBaseRight",
  "mouthLeft", "mouthRight", "leftCheek", "rightCheek",
];

// MediaPipe Face Landmarker (478-point mesh) indices.
// Left/right labels follow the mesh convention; every subscore in
// gas.js is mirror-invariant, so a mirrored selfie changes nothing.
export const MEDIAPIPE_INDEX = {
  foreheadTop: 10,
  chin: 152,
  leftFaceEdge: 234, // cheekbone extremes = face width
  rightFaceEdge: 454,
  noseTip: 1,
  noseBaseLeft: 129, // nasal alae = widest nose-base points
  noseBaseRight: 358,
  mouthLeft: 61,
  mouthRight: 291,
  leftCheek: 172, // jaw-angle pair, used as the lower-face symmetry pair
  rightCheek: 397,
  leftIris: 473,
  rightIris: 468,
  leftEyeCorners: [33, 133], // fallback when iris points are absent
  rightEyeCorners: [362, 263],
};

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Convert a MediaPipe 478-point result into gas.js named points (pixels). */
export function landmarksFromMediaPipe(points, { width, height } = {}) {
  if (!Array.isArray(points) || points.length < 455) {
    throw new Error(`MediaPipe result too short: ${points?.length} points`);
  }
  const px = (i) => {
    const p = points[i];
    return { x: width ? p.x * width : p.x, y: height ? p.y * height : p.y };
  };
  const idx = MEDIAPIPE_INDEX;
  const leftEye =
    points.length > Math.max(idx.leftIris, idx.rightIris)
      ? px(idx.leftIris)
      : mid(px(idx.leftEyeCorners[0]), px(idx.leftEyeCorners[1]));
  const rightEye =
    points.length > Math.max(idx.leftIris, idx.rightIris)
      ? px(idx.rightIris)
      : mid(px(idx.rightEyeCorners[0]), px(idx.rightEyeCorners[1]));
  return {
    foreheadTop: px(idx.foreheadTop),
    chin: px(idx.chin),
    leftFaceEdge: px(idx.leftFaceEdge),
    rightFaceEdge: px(idx.rightFaceEdge),
    leftEye,
    rightEye,
    noseTip: px(idx.noseTip),
    noseBaseLeft: px(idx.noseBaseLeft),
    noseBaseRight: px(idx.noseBaseRight),
    mouthLeft: px(idx.mouthLeft),
    mouthRight: px(idx.mouthRight),
    leftCheek: px(idx.leftCheek),
    rightCheek: px(idx.rightCheek),
  };
}

/** Names of required points that are missing or not finite numbers. */
export function missingPoints(p) {
  return REQUIRED_POINTS.filter(
    (k) => !p?.[k] || !Number.isFinite(p[k].x) || !Number.isFinite(p[k].y)
  );
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Rough head-pose estimate from 2D points. Photo-based symmetry is
 * easily contaminated by pose (see docs/GAS_REFERENCES.md), so the
 * app should ask for a retake instead of scoring a turned face.
 * yaw/roll are normalised deviations (0 = perfectly frontal);
 * pitchRatio is where the nose tip sits between forehead and chin
 * (about 0.5 when facing forward).
 */
export function estimatePose(p) {
  const { width, height } = faceSize(p);
  const toLeft = dist(p.noseTip, p.leftFaceEdge);
  const toRight = dist(p.noseTip, p.rightFaceEdge);
  return {
    yaw: (toLeft - toRight) / (toLeft + toRight),
    roll: (p.rightEye.y - p.leftEye.y) / height,
    pitchRatio: dist(p.foreheadTop, p.noseTip) / height,
  };
}

/** Capture-quality check. Returns a list of retake reasons (empty = good). */
export function assessCapture(p, { imageWidth } = {}) {
  const issues = [];
  const pose = estimatePose(p);
  const { width } = faceSize(p);
  if (Math.abs(pose.yaw) > 0.06) {
    issues.push({ code: "yaw", message: "顔が横を向いています。正面を向いてください" });
  }
  if (Math.abs(pose.roll) > 0.04) {
    issues.push({ code: "roll", message: "顔が傾いています。水平にしてください" });
  }
  if (pose.pitchRatio < 0.42 || pose.pitchRatio > 0.58) {
    issues.push({ code: "pitch", message: "顔が上下を向いています。まっすぐ前を見てください" });
  }
  if (imageWidth && width / imageWidth < 0.25) {
    issues.push({ code: "small", message: "顔が小さすぎます。もう少し近づいてください" });
  }
  return issues;
}

/** Score GAS from named points, with pose and capture assessment attached. */
export function gasFromLandmarks(p, { imageWidth } = {}) {
  const missing = missingPoints(p);
  if (missing.length > 0) {
    throw new Error(`missing landmark points: ${missing.join(", ")}`);
  }
  const { gas, subscores, weights } = scoreGAS(p);
  return {
    gas,
    subscores,
    weights,
    pose: estimatePose(p),
    issues: assessCapture(p, { imageWidth }),
    landmarks: p,
  };
}

/** Full pipeline for a MediaPipe result: convert, assess, score. */
export function gasFromMediaPipe(points, { width, height } = {}) {
  const landmarks = landmarksFromMediaPipe(points, { width, height });
  return gasFromLandmarks(landmarks, { imageWidth: width });
}
