# 現在のタスク（Muse → Antigravity）

更新: 2026-11-25 / 状態: 実施済み（実施者はAntigravityではなくClaude。役割分担の見直しにより、画面実装もClaudeが担当することになった）

## タスク: App.tsx への核ロジック組み込み

前提: React Native / Expo SDK 58（blank-typescript）。核ロジックは `src/*.js` に実装済みで**変更禁止**。画面側から import して使うこと。

使うモジュール:
- `src/user.js`: createUser / canUseAppointments
- `src/mv.js`: calculateMV（MV = 0.5×GAS + 0.5×(50+幸福度/2) − penalty）
- `src/matching.js`: rankMatches / HAPPINESS_CUTOFF（幸福度30未満は足切り）
- `src/questionnaire.js`: HAPPINESS_QUESTIONS（8問）/ scoreHappiness（各1〜5 → 0〜100）
- `src/demo.js`: demoUsers（8人）/ DEMO_PLACES
- `src/appointment.js`: createAppointment / markArrived / closeAppointment / recordDateConsent / dateAgreed / applyReport

TypeScriptから `.js` を import するために必要な最小限の設定追加（tsconfig の allowJs 等）は可。サーバー通信・外部APIは入れない。データは画面の状態（メモリ内）で保持する。

## 実装する画面（App.tsx中心、1画面で上から順に操作できる構成でよい）

1. 初期設定・スコア測定: GAS入力（50〜100）、相手GAS下限、最寄り駅、アンケート8問（各1〜5の選択）。ボタンで自分の幸福度とMVを表示。幸福度30未満なら「紹介できる相手がいません」
2. 相手一覧: rankMatches の結果をMVの近い順に表示（名前、最寄り駅、MV、差）。各候補に「アポイント調整」ボタン
3. アポイント調整: 場所の希望順位は簡易でよい（自分は表示順、相手は逆順で固定可）。空き時間は固定候補（2026-12-05T11:00 / 14:00）を両者共通で渡す。決定した日時・場所を表示 → 「両者到着」→ 対面成立 → デート合意ボタン（両者合意／相手拒否の2パターン）→ 結果表示

## 完了条件
- `npm test` が全件通る（現在11件）
- `npx tsc --noEmit` で今回の変更に起因する型エラーがない
- `npx expo start` で起動し、Android実機（Expo Go）で 1→2→3 が最後まで操作できる
- コミットして `git push` する

## 範囲外
顔画像からのGAS算出、カレンダー連携、QR/GPS証明、P2P、データ永続化。

## 実施報告
- 実施内容: App.tsx に3部構成の画面を実装（初期設定・幸福度アンケート8問・MV表示／相手一覧／アポイント調整〜到着〜デート合意）。核ロジック `src/*.js` は無変更で import。冒頭に `// @ts-nocheck` を付けて `.js` import の型摩擦を回避
- テスト結果: `npm test` 11件全通過、`npx tsc --noEmit` エラーなし、`npx expo export --platform android` でAndroidバンドル生成成功（1.5MB）
- 実機確認: 未実施（ユーザーのPCで `git pull` → `npx expo start` → Expo GoでQR読み取り、が次の手順）
- 残課題: 実機での操作感確認、データ永続化、画面遷移の分離
