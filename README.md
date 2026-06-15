# PFCメモ — セットアップガイド

カロリー・PFC管理PWA with Garmin Connect連携

---

## ファイル構成

```
pfc-app/
├── index.html               # メインUI
├── app.js                   # アプリロジック
├── sw.js                    # Service Worker（オフライン対応）
├── manifest.json            # PWAマニフェスト
├── netlify.toml             # Netlify設定
├── package.json
├── generate-icons.js        # アイコン生成スクリプト
├── icons/
│   ├── icon-192.png         # ← 自分で用意 or generate-icons.js で生成
│   └── icon-512.png
└── netlify/functions/
    ├── garmin-auth-start.js    # OAuth開始
    ├── garmin-auth-callback.js # OAuthコールバック
    └── garmin-daily.js         # 日次データ取得
```

---

## STEP 1 — Netlifyにデプロイする

### 1-1. GitHubリポジトリを作成

```bash
cd pfc-app
git init
git add .
git commit -m "initial commit"
```

GitHubで新規リポジトリを作成し、プッシュ：
```bash
git remote add origin https://github.com/あなたのユーザー名/pfc-memo.git
git push -u origin main
```

### 1-2. Netlifyと接続

1. https://app.netlify.com にアクセス（無料アカウントを作成）
2. "Add new site" → "Import an existing project"
3. GitHubを選択 → 先ほどのリポジトリを選ぶ
4. Build settings は自動検出されます（netlify.toml 参照）
5. "Deploy site" をクリック

数分でデプロイ完了。`https://ランダム名.netlify.app` のURLが発行されます。

### 1-3. カスタムドメイン（任意）

Netlifyのダッシュボード → "Domain settings" から好きなドメインを設定できます。
`pfc-memo.netlify.app` のようなサブドメインなら追加費用なし。

### 1-4. アイコンを用意する

**方法A: generate-icons.jsで自動生成**
```bash
npm install canvas
node generate-icons.js
```

**方法B: 手動で用意**
- 192×192px と 512×512px のPNG画像を `icons/` フォルダに置く
- 背景色 `#3266ad`、白文字でデザインすると統一感が出ます

---

## STEP 2 — Garmin Connect API に登録する

### 2-1. Garmin Developer アカウント作成

1. https://developer.garmin.com にアクセス
2. "Connect IQ" → "Developer Program" に登録（無料）
3. Garminアカウントでログイン

### 2-2. アプリケーションを登録

1. https://developer.garmin.com/gc-developer-program/overview/ にアクセス
2. "Request Access" からHealth & Fitness API（Wellness API）への申請を行う
   - 用途：「個人の食事・運動管理アプリ」と記載
   - 非商用・個人利用の場合は比較的早く承認される
3. 承認後、Developer Portalで新しいアプリを登録
4. OAuth Redirect URL に以下を設定：
   ```
   https://あなたのサイト名.netlify.app/.netlify/functions/garmin-auth-callback
   ```
5. **Client ID** と **Client Secret** を控える

> ⚠️ Garmin Wellness APIは申請制です。承認まで数日〜1週間かかる場合があります。

### 2-3. Netlifyに環境変数を設定

Netlify ダッシュボード → Site settings → Environment variables：

| 変数名 | 値 |
|---|---|
| `GARMIN_CLIENT_ID` | Garminから発行されたClient ID |
| `GARMIN_CLIENT_SECRET` | Garminから発行されたClient Secret |

設定後、"Trigger deploy" で再デプロイ。

---

## STEP 3 — スマホのホーム画面に追加（PWA）

### iPhoneの場合
1. Safariでアプリを開く
2. 下部の共有ボタン（□↑）をタップ
3. "ホーム画面に追加" を選択

### Androidの場合
1. Chromeでアプリを開く
2. "ホーム画面に追加" のバナーが自動表示される
   （または右上メニュー → "アプリをインストール"）

---

## 注意事項

- **データ保存場所**: ブラウザのlocalStorageに保存されます。ブラウザデータを消去すると記録も消えます。将来的にはSupabase等のクラウドDBへの移行を検討してください。
- **Garminトークン管理**: 現実装はシンプルなbase64エンコードです。本番運用では暗号化（JWTやAES等）を推奨します。
- **Open Food Facts**: CORSに対応した無料APIです。データ品質にばらつきがある場合があります。
