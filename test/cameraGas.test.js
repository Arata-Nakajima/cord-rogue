import { test } from "node:test";
import assert from "node:assert/strict";
import {
  landmarksFromMediaPipe, gasFromMediaPipe, gasFromLandmarks,
  missingPoints, MEDIAPIPE_INDEX,
} from "../src/cameraGas.js";

// The same symmetric, average-ratio face as test/gas.test.js,
// expressed in a 200x270 image.
const FACE = {
  foreheadTop: { x: 100, y: 0 },
  chin: { x: 100, y: 270 },
  leftFaceEdge: { x: 0, y: 100 },
  rightFaceEdge: { x: 200, y: 100 },
  leftEye: { x: 54, y: 90 },
  rightEye: { x: 146, y: 90 },
  noseTip: { x: 100, y: 135 },
  noseBaseLeft: { x: 75, y: 170 },
  noseBaseRight: { x: 125, y: 170 },
  mouthLeft: { x: 61, y: 187 },
  mouthRight: { x: 139, y: 187 },
  leftCheek: { x: 30, y: 150 },
  rightCheek: { x: 170, y: 150 },
};
const W = 200;
const H = 270;

/** Build a fake 478-point MediaPipe result (normalised 0-1) from FACE. */
function fakeMediaPipe(face, { noseTipShift = 0 } = {}) {
  const points = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  const set = (i, p) => {
    points[i] = { x: p.x / W, y: p.y / H };
  };
  const idx = MEDIAPIPE_INDEX;
  set(idx.foreheadTop, face.foreheadTop);
  set(idx.chin, face.chin);
  set(idx.leftFaceEdge, face.leftFaceEdge);
  set(idx.rightFaceEdge, face.rightFaceEdge);
  set(idx.noseTip, { x: face.noseTip.x + noseTipShift, y: face.noseTip.y });
  set(idx.noseBaseLeft, face.noseBaseLeft);
  set(idx.noseBaseRight, face.noseBaseRight);
  set(idx.mouthLeft, face.mouthLeft);
  set(idx.mouthRight, face.mouthRight);
  set(idx.leftCheek, face.leftCheek);
  set(idx.rightCheek, face.rightCheek);
  set(idx.leftIris, face.leftEye);
  set(idx.rightIris, face.rightEye);
  return points;
}

test("MediaPipe points convert back to the named points in pixels", () => {
  const p = landmarksFromMediaPipe(fakeMediaPipe(FACE), { width: W, height: H });
  assert.deepEqual(missingPoints(p), []);
  assert.ok(Math.abs(p.noseTip.x - 100) < 1e-6);
  assert.ok(Math.abs(p.rightEye.x - 146) < 1e-6);
  assert.ok(Math.abs(p.chin.y - 270) < 1e-6);
});

test("a frontal average face scores near the top with no retake issues", () => {
  const result = gasFromMediaPipe(fakeMediaPipe(FACE), { width: W, height: H });
  assert.ok(result.gas > 99, `expected near-max GAS, got ${result.gas}`);
  assert.deepEqual(result.issues, []);
});

test("a turned face is flagged for retake instead of silently scored", () => {
  const result = gasFromMediaPipe(fakeMediaPipe(FACE, { noseTipShift: 40 }), { width: W, height: H });
  assert.ok(result.issues.some((i) => i.code === "yaw"));
  assert.ok(Math.abs(result.pose.yaw) > 0.06);
});

test("missing points are reported by name", () => {
  const partial = { ...FACE };
  delete partial.noseTip;
  assert.deepEqual(missingPoints(partial), ["noseTip"]);
  assert.throws(() => gasFromLandmarks(partial), /noseTip/);
});

test("short detector output is rejected", () => {
  assert.throws(() => landmarksFromMediaPipe([{ x: 0, y: 0 }], { width: W, height: H }), /too short/);
});
