// Happiness score from a self-report questionnaire (v0 substitute for
// the brainwave / cortisol measurement in the spec). The scoring
// function is the only part a future hardware measurement must replace.

export const HAPPINESS_QUESTIONS = [
  "この1週間、気分が安定していた",
  "よく眠れている",
  "人と過ごす時間が楽しい",
  "自分の生活に満足している",
  "将来に希望が持てる",
  "ストレスをうまく流せている",
  "体調が良い",
  "好きなことに時間を使えている",
];

/** answers: array of 1-5 per question. Returns happiness 0-100. */
export function scoreHappiness(answers) {
  if (answers.length !== HAPPINESS_QUESTIONS.length) {
    throw new Error(`expected ${HAPPINESS_QUESTIONS.length} answers, got ${answers.length}`);
  }
  for (const a of answers) {
    if (!(a >= 1 && a <= 5)) throw new Error(`answer out of range (1-5): ${a}`);
  }
  const sum = answers.reduce((s, a) => s + a, 0);
  const max = HAPPINESS_QUESTIONS.length * 5;
  const min = HAPPINESS_QUESTIONS.length * 1;
  return Math.round(((sum - min) / (max - min)) * 100);
}

/** GAS in v0 is manual input (50-100); a face-image scorer replaces this later. */
export function validateGasInput(gas) {
  if (!(gas >= 50 && gas <= 100)) throw new Error(`gas out of range (50-100): ${gas}`);
  return gas;
}
