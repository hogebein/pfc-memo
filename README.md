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
- ビタミン・ミネラル・食物繊維の集計と達成度表示
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
