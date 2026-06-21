# PFCメモ — セットアップガイド

カロリー・PFC管理PWA with Google Health API連携、TDEE計算、エネルギー収支表示

---

## ファイル構成

```
pfc-app/
├── index.html
├── app.js
├── sw.js                          # Service Worker（オフライン対応）
├── manifest.json                  # PWAマニフェスト
├── netlify.toml
├── package.json
├── generate-icons.js
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── netlify/functions/
    ├── google-health-auth-start.js    # OAuth 2.0 認証開始
    ├── google-health-auth-callback.js # OAuth 2.0 コールバック
    └── google-health-daily.js         # 日次データ取得
```

---

## STEP 1 — Netlifyにデプロイ

1. GitHubリポジトリを作成してプッシュ
2. https://app.netlify.com で "Import from GitHub"
3. リポジトリを選択 → Deploy

---

## STEP 2 — Google Health API 設定

### 2-1. Google Cloud Console でプロジェクト作成

1. https://console.cloud.google.com にアクセス
2. 新規プロジェクトを作成
3. 「APIとサービス」→「ライブラリ」で **Google Health API** を検索して有効化

### 2-2. OAuth 2.0 クライアントID 作成

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
2. アプリの種類：**ウェブアプリケーション**
3. 承認済みのリダイレクトURIに以下を追加：
   ```
   https://あなたのサイト名.netlify.app/.netlify/functions/google-health-auth-callback
   ```
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
- 食品検索（内蔵DB + Open Food Facts API + カスタム登録）
- **TDEE計算**（国立健康・栄養研究所式BMR × 気温補正 × 活動係数）
- **エネルギー収支**（DIT補正・食物繊維補正後の正味摂取カロリー vs TDEE）
- **補正前/補正後/収支グラフ**の切り替え
- ビタミン・ミネラル・食物繊維の集計と達成度表示
- 運動ログ（METs計算）
- CSV入出力
- Google Health API連携（歩数・消費カロリー・心拍数・体重）

---

## STEP 4 — Firebase クラウド同期設定（オプション）

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
