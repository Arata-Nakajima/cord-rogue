import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreGAS, symmetryScore, averagenessScore } from "../src/gas.js";

// A fully symmetric face whose ratios match the bundled average face.
const symmetricFace = {
  foreheadTop: { x: 100, y: 0 },
  chin: { x: 100, y: 270 },
  leftFaceEdge: { x: 0, y: 100 },
  rightFaceEdge: { x: 200, y: 100 },
  leftEye: { x: 64, y: 90 },
  rightEye: { x: 136, y: 90 },
  noseTip: { x: 100, y: 135 },
  noseBaseLeft: { x: 74, y: 170 },
  noseBaseRight: { x: 126, y: 170 },
  mouthLeft: { x: 62, y: 210 },
  mouthRight: { x: 138, y: 210 },
  leftCheek: { x: 30, y: 150 },
  rightCheek: { x: 170, y: 150 },
};

const asymmetricFace = {
  ...symmetricFace,
  rightEye: { x: 152, y: 100 },
  rightCheek: { x: 188, y: 162 },
  mouthRight: { x: 150, y: 218 },
};

test("symmetric face gets a perfect symmetry score", () => {
  assert.equal(symmetryScore(symmetricFace), 100);
  assert.equal(averagenessScore(symmetricFace), 100);
});

test("GAS stays within 50-100 and rewards symmetry", () => {
  const good = scoreGAS(symmetricFace);
  const bad = scoreGAS(asymmetricFace);
  assert.ok(good.gas >= 50 && good.gas <= 100);
  assert.ok(good.gas > 95, `expected high GAS, got ${good.gas}`);
  assert.ok(bad.gas < good.gas, `asymmetric ${bad.gas} should be below symmetric ${good.gas}`);
  assert.ok(symmetryScore(asymmetricFace) < 100);
});
