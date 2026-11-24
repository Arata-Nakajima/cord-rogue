// Deterministic demo users for local trials (no real people's data).
import { createUser } from "./user.js";

const SEED = [
  { id: "demo-aya", displayName: "demo-aya", gas: 82, happiness: 64, gasCutoff: 55, nearestStation: "梅田" },
  { id: "demo-ren", displayName: "demo-ren", gas: 76, happiness: 58, gasCutoff: 50, nearestStation: "難波" },
  { id: "demo-yui", displayName: "demo-yui", gas: 68, happiness: 72, gasCutoff: 60, nearestStation: "天王寺" },
  { id: "demo-sora", displayName: "demo-sora", gas: 91, happiness: 45, gasCutoff: 70, nearestStation: "梅田" },
  { id: "demo-hina", displayName: "demo-hina", gas: 59, happiness: 38, gasCutoff: 50, nearestStation: "京橋" },
  { id: "demo-kai", displayName: "demo-kai", gas: 73, happiness: 25, gasCutoff: 50, nearestStation: "梅田" },
  { id: "demo-mei", displayName: "demo-mei", gas: 85, happiness: 80, gasCutoff: 65, nearestStation: "心斎橋" },
  { id: "demo-rio", displayName: "demo-rio", gas: 64, happiness: 55, gasCutoff: 50, nearestStation: "難波" },
];

export function demoUsers() {
  return SEED.map((s) => createUser(s));
}

export const DEMO_PLACES = [
  { id: "place-umeda", name: "梅田スカイビル前" },
  { id: "place-namba", name: "なんばパークス前" },
  { id: "place-tennoji", name: "あべのハルカス前" },
];
