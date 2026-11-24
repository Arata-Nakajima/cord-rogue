---
description: GitHubから最新を取得し、docs/CURRENT_TASK.md のタスクを実行する
---

1. `git pull` でリポジトリを最新にする
2. `docs/CURRENT_TASK.md` を読み、その内容をタスクとして実行する（AGENTS.md のプロジェクト制約に従う）
3. 完了したら `npm test` を実行し、`docs/CURRENT_TASK.md` の「実施報告」欄を埋めて、コミットして `git push` する
