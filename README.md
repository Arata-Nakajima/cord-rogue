# Cord Rogue（コードルージュ）

外見のGAS値（Golden Ratio / Averageness / Symmetry）と幸福度のスコアのみでユーザーをソートし、スコアの近いユーザー同士をマッチングさせるアプリ。仕様: https://note.com/nakajima_arata/n/na413ec3bad1c

## 原則

- オープンソース・無償
- **サーバを持たない**：常時稼働サーバは運用せず、計算はすべてスマホのローカル計算資源で実行する。個人情報はサーバに置かない
- 顔画像は端末内で処理し、外部に送信しない

## 形態（2026-11-25決定）

クロスプラットフォームのスマホアプリ（1つのコードでiPhone / Android両対応）。
M1の核ロジックは JavaScript で書いてあり、そのまま TypeScript / React Native 系のアプリ本体に組み込める形にしてある。インストール型PWAは採用しない（Bluetoothや端末機能の制限のため）。

## 現在の状態：M1〜M5の核ロジック実装済み（テスト11件通過）

- `src/user.js` — ユーザーのデータモデル、年次更新の期限チェック
- `src/mv.js` — MV = α × GAS + β × 幸福度 − ペナルティ（v0は α=β=0.5 固定、幸福度は50〜100に正規化）
- `src/matching.js` — 足切り（幸福度・相互GAS）と、MVの近い順の並び替え、調整済みペアの除外
- `src/penalty.js` — 不出頭／リスケ／規約違反のペナルティと年次リセット
- `src/questionnaire.js` — 幸福度の自己申告アンケート（8問）から 0〜100 を算出（将来の脳波計測定と差し替え可能）
- `src/demo.js` — デモユーザー8人と集合場所候補
- `src/appointment.js` — 場所・日時の決定、到着証明の代替、デート合意、規約違反報告の有効性判定

## プロトタイプ画面

最終形はスマホアプリですが、流れを試す仮画面が `prototype/demo.html` にあります。

```
python3 -m http.server 8000
# ブラウザで http://localhost:8000/prototype/demo.html を開く
```

## テスト

```
npm test
```

Node標準のテストランナーのみ使用し、依存パッケージはない。

## ライセンス

未定（MIT / Apache-2.0 を想定）。

## スマホアプリの開発・起動方法（Expo / React Native）

依存パッケージのインストール：

```
npm install
```

開発サーバーの起動（Expo Go でQRコードを読み取ってAndroid/iOSで確認）：

```
npx expo start
```

- Androidスマホに [Expo Go](https://expo.dev/go) をインストールし、PCと同じWi-Fiに接続してQRコードをスキャンする
- Wi-Fiをまたぐ場合は `npx expo start --tunnel` を使う
