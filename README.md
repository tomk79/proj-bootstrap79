# proj-bootstrap79

まっさらなリポジトリに、アプリを書き始める**前**に置くものを置く道具。

```
mkdir my-app && cd my-app
npx github:tomk79/proj-bootstrap79
```

いくつかの質問（アプリの種類・スタック・CI・ホスティング）に答えると、次が置かれる。
アプリの種類は**複数選べる**（デスクトップ＋対応するモバイル＋紹介用のウェブ、など）。複数選ぶとスタックは種類ごとに訊かれ、置き場は `apps/<種別>/` に分かれる。

| 置くもの | 役割 |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | 置き手紙。プロジェクトを跨いで変わらないルール ＋ 選んだスタックの作法 |
| `.claude/settings.json` | 許可・不許可（`.env` 系の読み書き禁止など） |
| `docs/GRILL.md` | **grill-me に必ず埋めさせる問いの空欄**。不可逆の決定はここに書く |
| `.gitignore` | 最低限 |

最後に「次に叩くコマンド」を表示する（`npm create tauri-app` など）。

## ローカルで動作を試す

`try/` は git から除外してある（`.gitignore`）。この中に捨てるつもりのディレクトリを掘って、**GitHub ではなくローカルの相対パス**を `npx` に渡す。パスは常にリポジトリのルート＝実行するディレクトリから見て `../..`。

```
mkdir -p try/sample && cd try/sample
npx ../..
```

`bin/` `lib/` `templates/` への編集はそのまま次の実行に乗る（npx がその都度ローカルのパッケージを読む）。インストールの手間を惜しむなら直接叩いてもいい。

```
node ../../bin/proj-bootstrap79.js
```

質問を飛ばす（AI や CI から呼ぶときと同じ渡し方）:

```
npx ../.. --name=sample-app --type=cli --stack=node-cli --ci=github --hosting=none
```

複数の種類を渡すときはカンマ区切り。`--stack=` も同じ数だけ並べる（どの種類のものかは `lib/questions.mjs` の `for` から引くので、順番は問わない）。

```
npx ../.. --name=sample-app --type=desktop,web --stack=tauri,next-vercel-supabase --ci=github --hosting=vercel
```

`--type` `--stack` `--ci` `--hosting` の候補は `lib/questions.mjs` のキー。既にファイルがある状態での挙動（触らない／`--force` で上書き）も、同じディレクトリで二度叩けば確かめられる。

試し終わったら捨てる。

```
cd ../.. && rm -rf try/sample
```

## やらないこと

- フレームワークの雛形は生成しない。公式のスキャフォルダに任せる（複製は腐るため）。
- 既存ファイルは上書きしない（`--force` を付けたときだけ）。

## 設計の前提

- **不変**（全プロジェクト共通のルール）は `templates/base/` に。各ルールには**由来**を1行添える。
- **準不変**（スタックごとの作法）は `templates/stack/<key>/STACK.md` に。
- **可変**（このアプリは何か・変えられない決定）は `docs/GRILL.md` の空欄として渡し、grill-me が埋める。
- 総量は小さく保つ。増やすときは何かを削る。
