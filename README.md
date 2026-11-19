# PFCメモ — セットアップガイド

カロリー・PFC管理PWA with Google Health API連携、TDEE計算、エネルギー収支表示

---

## ファイル構成

```
pfc-app/
├── index.html
├── app.js
├── foods-db.js                    # 内蔵食品データベース
├── sw.js                          # Service Worker（オフライン対応）
├── manifest.json                  # PWAマニフェスト
├── netlify.toml                   # Netlify用設定
├── vercel.json                    # Vercel用設定（代替デプロイ先）
├── package.json
├── build.js                       # sw.jsのキャッシュバージョンを埋め込むビルドスクリプト
├── generate-icons.js
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── netlify/functions/             # Netlifyデプロイ時に使われる関数
│   ├── ai-chat.js                     # Gemini APIプロキシ
│   ├── google-health-auth-start.js    # OAuth 2.0 認証開始
│   ├── google-health-auth-callback.js # OAuth 2.0 コールバック
│   └── google-health-daily.js         # 日次データ取得
└── api/                            # Vercelデプロイ時に使われる関数（内容は上と同等）
    ├── ai-chat.js
    ├── google-health-auth-start.js
    ├── google-health-auth-callback.js
    └── google-health-daily.js
```

デプロイ先ごとにサーバーレス関数の置き場所が異なる（Netlifyは`netlify/functions/`、Vercelは`api/`）ため両方を同梱していますが、`index.html`・`app.js`・`foods-db.js`などのフロントエンド部分は完全に共通です。`vercel.json`のrewrite設定により、フロントエンドのコードは`/.netlify/functions/...`というパスのままVercel上でも動作します（書き換え不要）。

---

## STEP 1 — Netlifyにデプロイ

1. GitHubリポジトリを作成してプッシュ
2. https://app.netlify.com で "Import from GitHub"
3. リポジトリを選択 → Deploy

---

## STEP 1' — 代替デプロイ先: Vercel（Netlifyの無料枠を使い切った場合など）

NetlifyとVercelはどちらも無料枠でこのアプリを問題なく運用できます。同じGitHubリポジトリから、Netlifyの代わりに（あるいは両方同時に）Vercelへデプロイすることも可能です。移行にあたってのフロントエンド側の書き換えは不要です。

### 1'-1. デプロイ

1. https://vercel.com にアクセスし、GitHubアカウントでログイン
2. "Add New..." → "Project" → このリポジトリを選択
3. Framework Preset は **Other**（自動検出される場合はそのままでOK）のまま "Deploy"
   - `vercel.json` により、ビルドコマンド・ルーティング・キャッシュヘッダーは自動で設定されます
   - `netlify/functions/` 配下は無視され、`api/` 配下の関数が使われます

デプロイ完了後に発行される `https://プロジェクト名.vercel.app` がサイトURLになります。

### 1'-2. 環境変数の設定

Netlifyで設定した環境変数はVercelには引き継がれません。同じ変数名で再度設定してください。

Vercelダッシュボード → プロジェクトを選択 → Settings → Environment Variables：

| 変数名 | 値 |
|---|---|
| `GEMINI_API_KEY` | STEP 3.5 で取得したAPIキー（AIアシスタントを使う場合） |
| `GOOGLE_HEALTH_CLIENT_ID` | STEP 2 で取得したクライアントID（Google Health連携を使う場合） |
| `GOOGLE_HEALTH_CLIENT_SECRET` | STEP 2 で取得したシークレット（同上） |

設定後、Deployments タブから最新デプロイの "Redeploy" を実行してください。

### 1'-3. Google Health連携を使う場合の追加設定

Vercel用のURLは Netlify用と異なるため、**Google Cloud ConsoleのOAuthクライアントに、Vercel用のリダイレクトURIを追加登録**する必要があります（既存のNetlify用のURIは削除せず、両方登録しておけば両方のデプロイ先を併用できます）。

「APIとサービス」→「認証情報」→ 対象のOAuthクライアントID → 「承認済みのリダイレクトURI」に追加：

```
https://プロジェクト名.vercel.app/api/google-health-auth-callback
```

（Netlify版は `/.netlify/functions/google-health-auth-callback` でしたが、Vercel版は `/api/google-health-auth-callback` になる点に注意してください）

### 1'-4. Firebase クラウド同期を使う場合

STEP 4 の設定はデプロイ先に依存しないため、変更不要です（`index.html`に直接書き込む方式のため）。ただし、Firebase Authenticationの「承認済みドメイン」に、Vercelのドメイン（`プロジェクト名.vercel.app`）も追加登録してください。

Firebase Console → Authentication → Settings → 承認済みドメイン → ドメインを追加

---

## STEP 2 — Google Health API 設定

### 2-1. Google Cloud Console でプロジェクト作成

1. https://console.cloud.google.com にアクセス
2. 新規プロジェクトを作成
3. 「APIとサービス」→「ライブラリ」で **Google Health API** を検索して有効化

### 2-2. OAuth 2.0 クライアントID 作成

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
2. アプリの種類：**ウェブアプリケーション**
3. 承認済みのリダイレクトURIに以下を追加（Netlifyにデプロイした場合）：
   ```
   https://あなたのサイト名.netlify.app/.netlify/functions/google-health-auth-callback
   ```
   Vercelにデプロイした場合は STEP 1'-3 を参照してください（URIの形式が異なります）。
4. **クライアントID** と **クライアントシークレット** を控える

### 2-3. Netlify 環境変数に設定

Netlify ダッシュボード → Site settings → Environment variables：

| 変数名 | 値 |
|---|---|
| `GOOGLE_HEALTH_CLIENT_ID` | Google Cloud Console で発行したクライアントID |
| `GOOGLE_HEALTH_CLIENT_SECRET` | Google Cloud Console で発行したシークレット |

設定後、"Trigger deploy" で再デプロイ。

### 取得できるデータ

- 歩数（steps）
- 活動消費カロリー（activeCalories）
- 総消費カロリー（totalCalories）
- 安静時心拍数（restingHeartRate）
- 体重（weight）

---

## STEP 3 — スマホのホーム画面に追加（PWA）

### iPhone (Safari)
1. Safariでアプリを開く → 共有ボタン → "ホーム画面に追加"

### Android (Chrome)
1. Chromeでアプリを開く → "アプリをインストール" バナーをタップ

---

## 主な機能

- 食事記録（朝食・昼食・夕食・間食）
- 食品検索（内蔵DB + カスタム/複合食品。ひらがな・カタカナ・ローマ字対応。外部の食品DBは参照しません）
- **TDEE計算**（Mifflin-St Jeor式BMR × 気温補正 × 活動係数）
- **エネルギー収支**（DIT補正・食物繊維補正後の正味摂取カロリー vs TDEE）
- **補正前/補正後/収支グラフ**の切り替え
- 記録タブで、食事記録を**長押し→別の記録にドラッグ**するとグループ（複合食品）にまとめられる（iOSのフォルダ風）。グループは材料ごとの分量調整・解除・複合食品DBへの登録ができる
- 食品の記録は、検索結果をタップすると既定の量（1食分 → 前回の量 → 基準量）ですぐ記録。量は記録の行の中で調整（量の表示をタップ → −／＋・倍率・前回の量）。検索欄に「ご飯150」「卵2個」と打てばその量でそのまま記録。✏️の編集フォームから複製もできる
- AIタブのプロンプト雛形: 押すと送信せずチャット欄にコピー（【…】を選択状態に）。複数登録・編集・並べ替え・削除・初期化ができ、クラウドにも同期
- 食品登録タブは簡易データベース: 検索・カテゴリ・ソート・複製・編集・一括操作（選択モード）・カテゴリ管理（単品/複合の両方）
- CSV出力: 食事記録（実質カロリー列つき。各行の右端にその日のBMR・TDEE・総消費・摂取・実質収支）と、ファイル末尾の日別の消費カロリー表（BMR・TDEEの計算式つき）。「日別CSV」は、TDEE・運動・摂取・実質収支・計算式だけを期間内の全日（記録のない日も）1つの表にしたファイル
- ビタミン・ミネラル・食物繊維の集計と達成度表示（食物繊維は水溶性/不溶性の内訳つき。内訳は成分表の値またはカテゴリからの推定比率）
- 運動ログ（METs計算）
- CSV入出力
- Google Health API連携（歩数・消費カロリー・心拍数・体重）

---

## STEP 3.5 — AI アシスタント設定

AIタブでGemini AIによる食事記録の自動登録・操作を利用するには、Google Gemini APIキーが必要です。
**無料枠あり・クレジットカード不要**で始められます。

### 3.5-1. APIキーを取得

1. https://aistudio.google.com にアクセス（Googleアカウントでログイン）
2. 右上「Get API key」→「Create API key」
3. 表示されたキーをコピー（後から確認可能）

> 💡 **無料枠について（2025年時点）**
> - `gemini-2.5-flash-lite`: 1日1,000リクエスト / 毎分15リクエスト
> - `gemini-2.5-flash`:      1日250リクエスト / 毎分10リクエスト
> - クレジットカード不要・個人利用であれば無料枠で十分
> - 使用量は https://aistudio.google.com で確認できます

### 3.5-2. Netlify 環境変数に設定

Netlify ダッシュボード → Site configuration → Environment variables → 「Add a variable」：

| 変数名 | 値 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studioで発行したAPIキー |

設定後、「Trigger deploy」→「Clear cache and deploy site」で再デプロイ。

### 3.5-3. 動作確認

デプロイ完了後、AIタブを開いて話しかけてみてください。
`GEMINI_API_KEY が設定されていません` と表示される場合は環境変数の設定と再デプロイを確認してください。

### 3.5-4. （任意）AIチャットの乱用防止

`/.netlify/functions/ai-chat` はURLさえ分かれば誰でも呼び出せるため、URLが漏れると無料枠を消費される可能性があります。気になる場合は以下で簡易的な認証を追加できます（未設定時は今まで通り無制限で動作します）。

1. Netlify環境変数に `APP_ACCESS_TOKEN`（好きな文字列）を追加して再デプロイ
2. ブラウザでアプリを開き、開発者ツールのコンソールで以下を実行：
   ```js
   localStorage.setItem('appAccessToken', 'ここに1と同じ文字列')
   ```

これでAIチャットのリクエストにトークンが自動で付与されるようになります。

---

## STEP 4 — Firebase クラウド同期設定（オプション） クラウド同期設定（オプション）

クラウド同期を有効にすることで、PC・スマホ問わず同じデータにアクセスできます。
未設定の場合はローカル保存モードで動作します。

### 4-1. Firebase プロジェクト作成

1. https://console.firebase.google.com にアクセス
2. 「プロジェクトを追加」→ 任意の名前でプロジェクトを作成
3. 「Googleアナリティクス」は任意（不要なら無効でOK）

### 4-2. Authentication を設定

1. Firebase Console > Authentication > ログイン方法
2. **Google** を有効化
3. プロジェクトのサポートメールを設定して保存

### 4-3. Firestore Database を作成

1. Firebase Console > Firestore Database > 「データベースの作成」
2. ロケーション：**asia-northeast1（東京）** を選択
3. セキュリティルール：「本番環境モード」で開始
4. 以下のルールを設定（ユーザー自身のデータのみ読み書き可能）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4-4. ウェブアプリを登録してFirebase設定を取得

1. Firebase Console > プロジェクトの概要 > 「ウェブ」アイコンをクリック
2. アプリのニックネームを入力して登録
3. 表示された `firebaseConfig` の値を控える

### 4-5. index.html に設定を記述

`index.html` 末尾の `window.FIREBASE_CONFIG` を実際の値に書き換え：

```javascript
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...",
};
```

書き換え後、GitHubにプッシュ → Netlifyが自動デプロイします。

### データ構造

Firestoreに以下の形式で保存されます：

```
/users/{uid}/
  entries[]        - 食事記録
  exercises[]      - 運動記録
  customFoods[]    - カスタム食品
  comboFoods[]     - 複合食品
  profile{}        - ユーザー設定（体重・身長など）
  updatedAt        - 最終更新日時
```

### オフライン動作

Firebase未設定 or 未ログイン時はlocalStorageに保存されます。
ログイン後に既存のローカルデータは自動的にクラウドにアップロードされます。

## 食物繊維の水溶性/不溶性を成分表の実測値に差し替える

内蔵DB（foods-db.js）の水溶性/不溶性の多くは食品カテゴリからの推定値（`fibEst:1`）です。文科省の
「日本食品標準成分表（八訂）増補2023年 **炭水化物成分表編**」のExcelがあれば、成分表の値に差し替えられます
（八訂の本表には食物繊維の総量しか載っていません）。

```
npm install --no-save xlsx
node scripts/import-mext-fiber.js <炭水化物成分表編.xlsx>          # ドライラン: scripts/out/mext-fiber-report.csv に照合結果を出力
node scripts/import-mext-fiber.js <炭水化物成分表編.xlsx> --apply  # 反映（foods-db.js.bak を自動作成）
```
曖昧・低スコア・総量が大きく食い違うものは自動では反映されません。`scripts/mext-name-map.example.json` を
`mext-name-map.json` にコピーして「当アプリの食品名 → 成分表の食品名」を書くと、その対応が最優先されます。

`scripts/check-mext-totals.js <本表.xlsx>` は、八訂の**本表**のExcelと foods-db.js の食物繊維総量を突き合わせて食い違いを一覧にします（確認専用）。

## テスト

jsdom でアプリを読み込んで画面操作まで確認するテストが `tests/` にあります（初回のみ `npm install --no-save jsdom`）。

```
npm test    # tests/core.test.js（DB整合・AIコマンドの保存・クラウド同期・食品登録タブ・TDEE）、tests/group-drag.test.js（記録のドラッグ＆グループ化）、tests/prompt-templates.test.js（AIプロンプトの雛形）、tests/amount-inline.test.js（行の中の量の調整・検索欄の量指定・複製）、tests/csv-export.test.js（CSV出力）、tests/search-focus.test.js（記録タブの検索欄フォーカス）
```

## アーカイブ

使わなくなった機能のソース（数量シート・左スワイプ・食品ごとの単位・スライダー版の量のUI）と、完全版のスナップショットを `docs/archive/` に残しています。再利用の手順は `docs/archive/README.md` を参照してください。

## 筋トレ記録と筋肥大の評価

記録タブの「運動」ブロックから、種目ごとにセット（重量・回数・RIR）を記録できます。統計タブの「筋トレ評価」に、13部位ごとの週あたり有効セット数・刺激スコア・4週あたりの筋サイズ変化の範囲と、全身の筋肉量増加見込み(kg)を表示します。

- エネルギー不足は Murphy & Koehler の回帰直線のゼロ点（約500kcal/日）を使い、軽い赤字ほど影響が小さい凸のカーブに。経験が浅い（最大で半分）・体脂肪率が高い（最大で4割。プロフィールの体脂肪率を使用）ほどさらに緩和。リコンプの根拠は Barakat 2020。
- 同じ収支から、4週の脂肪の変化の見込み（脂肪7200kcal/kg・筋肉4500kcal/kg）も表示。
- CSV: 設定タブの「筋トレCSV」で、1セット1行の表と週×部位の有効セット数の表を出力。
- 計算は `strength-model.js`（DOM非依存）。有効セット＝セット数 × RIRの重み × 回数の重み、間接的に使う部位は0.5セット換算。筋サイズ変化は有効セットの平方根に比例。
- 食事記録（直近28日のうち記録のある日）のエネルギー収支とタンパク質/kgで補正。経験は区分ではなく、部位ごとの累積有効セット数から伸びしろの残りを減衰させて表現（記録前の経験は任意入力）。
- 根拠: Pelland et al. 2026 (Sports Med)、Robinson et al. 2024 (Sports Med)、Lopez et al. 2021 (MSSE)、Murphy & Koehler 2022 (SJMSS)、Morton et al. 2018 (BJSM)。個々の係数と経験による減衰、範囲(×0.55〜×1.5)はこのアプリの仮定です。
- セット数から消費kcalを運動記録へ自動計上（1セット2.5分×4.5METs、チェックでON/OFF）。

## 添加した塩

記録タブの栄養素バー（塩分）の下にある「🧂 添加した塩」で、調理中や食卓で足した塩のg数を、食事を選んで入力できます。食事に「食塩（添加）」という1件の記録（食塩相当量=入力したg、カロリー0）として入り、同じ食事への追加は自動で合算されます。日別の塩分合計・統計・CSV・AIの文脈・日付コピー・クラウド同期にはそのまま反映され、塩分バーには「食品 / 添加」の内訳が出ます。AIには「塩を2g足した」と伝えても同じ形式で登録されます。

## AIによる食品DBの一括修正

AIチャットで「パン系の複合食品には100gあたり1%の食塩を追加して」のように頼むと、`edit_foods` コマンドで、条件に合うカスタム食品・複合食品をルールで一括修正します。AIは「対象の条件」と「ルール」だけを短く返し、絞り込み・計算・保存はアプリ側で行うため、食品ごとの値を出力させずに済み、トークンをほとんど使いません。

- 対象: `db`（custom/combo/both）＋ `names`（完全一致）/`name_contains`（部分一致・OR）/`exclude_contains`/`category` のいずれか。条件なしは拒否、100件超は中止。
- ルール: `add_per100`（100gあたり+x）/`set_per100`/`mul`/`add`/`set` を、cal・p・f・c・各ミクロ栄養素に。`dry_run` なら対象一覧だけ返します。
- 複合食品は材料が正なので、食塩の追加は材料「食塩（添加）」として足され（重さも増える）、他の栄養素の増減は重さ0.1gの材料「調整（AI）」に持たせます。合計は材料から再計算され、複合食品の編集や記録の材料編集でも元に戻りません。
- 実行前にAIバックアップを取るため、AI操作の履歴から元に戻せます。記録済みの食事は変更しません。

## グリコーゲン推定

統計タブの「グリコーゲン推定（肝臓・筋肉）」で、肝臓と筋肉のグリコーゲン量を **g で、誤差範囲つき** で表示します（合計・肝臓・筋肉、直近7日の推移グラフ、筋肉の部位別の充填率）。計算は `glycogen-model.js`（DOM非依存）。

- 1時間刻みで、食事の糖質（炭水化物−食物繊維。摂取後4時間で吸収、記録の時刻を使用）→ 安静時の糖質酸化 → 余りを肝臓・筋肉へ貯蔵。肝臓は血糖維持で減り（絶食24時間で約65%減）、筋肉は運動・筋トレ（部位ごとの有効セット数。3セット約25%・6セット約38%）と日常活動で減ります。貯蔵が少ないほど糖質酸化が減る自己調節も入れています。
- 貯蔵量は全身で約500g（肝臓約100g、筋肉約15g/kg×推定骨格筋量）。持久系の運動は消費カロリーとMETsから糖質使用量を出し、運動の時刻は18時と仮定します。
- 誤差範囲は、貯蔵容量・摂取量・消費量・運動の影響・回復速度・開始時の貯蔵量などの不確かさを振った100回の計算の10〜90%の幅です（統計的な信頼区間ではありません）。未記録日は直近の平均摂取で補完し、その分の不確かさも加えます。
- 食事の記録が直近14日に2日以上あると表示されます。係数（吸収速度、糖質酸化の割合、回復速度など）は本アプリの仮定です。

## 糖質の表示

記録タブの炭水化物カードに「糖質」（= 炭水化物 − 食物繊維、食品ごとに0未満にならないよう丸めて合計）を追加しました。栄養内訳の炭水化物パネルには糖質と食物繊維の量、統計タブの炭水化物バーの下には期間平均の糖質を表示します。食品CSVには `net_carb` 列、日別CSVには `intake_net_carb_g` 列を追加しました（CSVインポートは列名で読むため影響ありません）。グリコーゲン推定も同じ定義の糖質を使います。

## 複合食品の登録画面の栄養表示

食材の検索結果に食物繊維・塩分を追加し、追加済み材料の各行に、入れた量での栄養（kcalと全体に占める割合、PFC、糖質、食物繊維、塩分）を表示します。「全栄養素」を開くと、ミクロ栄養素（鉄・Ca・ビタミン類・ヨウ素・食物繊維の水溶性/不溶性・塩分）と元データ（100gあたりなど）が見られます。量の入力中は入力欄を作り直さず、材料ごとの表示と割合、合計だけを更新します。合計欄には重量・糖質・食物繊維・塩分を出し、「全栄養素の合計と100gあたり」で全項目を確認できます。
