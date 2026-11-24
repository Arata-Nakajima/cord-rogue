import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreGAS, symmetryScore, averagenessScore, pallettRatioScore, GAS_WEIGHTS } from "../src/gas.js";

// A fully symmetric face whose ratios match the average-face targets
// (Farkas norms + Pallett optima used in src/gas.js).
const symmetricFace = {
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

const asymmetricFace = {
  ...symmetricFace,
  rightEye: { x: 158, y: 100 },
  rightCheek: { x: 188, y: 162 },
  mouthRight: { x: 150, y: 196 },
};

test("average symmetric face scores at the top of every subscore", () => {
  assert.equal(symmetryScore(symmetricFace), 100);
  assert.equal(averagenessScore(symmetricFace), 100);
  assert.ok(pallettRatioScore(symmetricFace) > 99);
});

test("weights follow the literature synthesis and sum to 1", () => {
  assert.equal(GAS_WEIGHTS.averageness, 0.6);
  assert.equal(GAS_WEIGHTS.symmetry, 0.25);
  const sum = Object.values(GAS_WEIGHTS).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("GAS stays within 50-100 and rewards symmetry", () => {
  const good = scoreGAS(symmetricFace);
  const bad = scoreGAS(asymmetricFace);
  assert.ok(good.gas >= 50 && good.gas <= 100);
  assert.ok(good.gas > 99, `expected near-max GAS, got ${good.gas}`);
  assert.ok(bad.gas < good.gas, `asymmetric ${bad.gas} should be below symmetric ${good.gas}`);
  assert.ok(symmetryScore(asymmetricFace) < 100);
});
