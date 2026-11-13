# アーカイブ（過去のUIの実装）

使わなくなった機能のソースを、将来再利用できるように残しています。アプリ本体からは読み込まれません（`docs/` 配下の参考資料です）。

| 場所 | 内容 | 状態 |
|---|---|---|
| `amount-sheet/` | **数量シート**（画面下から出る量の指定画面）・**左スワイプで複製/削除**・**食品ごとの単位**（1個＝50gなど） | 2026-11-03時点の実装。「別ウィンドウは過剰」として2026-11-04に撤去 |
| `old-amount-ui/` | **スライダー版の量のUI**（✏️フォーム内のスライダー・±1/5/10gボタン・小さじ/大さじボタン） | 最初にアップロードされた版から抜き出し |
| `snapshots/2026-11-03_with-amount-sheet.zip` | 数量シート版の `app.js` / `index.html` / `foods-db.js`（そのまま動く完全版） | 上の3ファイルを重ねると、その状態に戻る |
| `snapshots/2026-10-01_original-upload.zip` | 最初にアップロードされた版（改修前のすべて） | 参照用 |

## 数量シート（`amount-sheet/`）

- `sheet.js` … ① 設定（確認する／すぐ記録）② 既存の記録の量の変更 ③ シート本体（開く・閉じる・描画・倍率・＋/−の長押し連続・数字キー・極端な量の確認）④ 検索結果タップ時の動き
- `sheet-swipe-units.css` … シート（`.as-*`）・スワイプ（`.sw-*`）・単位（`.fd-units-row`）のCSS
- `sheet.html` … `index.html` に置いていた容器（`#amountSheet`）
- `integration-notes.md` … 行・編集フォームのどこにつながっていたか
- 依存: `fmtAmt`、`defaultAmountFor` / `recentAmountsFor`（履歴からの既定量・よく使う量）は**現行の `app.js` にも残っています**。`showActionToast`・`recomputeEntryFromIngredients` も現行にあります。

### 戻し方（部分的に再利用する場合）
1. `sheet.js` を `app.js` に貼る（現行の `selectAddResult` / `registerFromSelection` は ④ の版に置き換え）。`amountStep` は `sheet.js` 内にもあり、現行の同名の定義と重複するため、片方を消す。
2. `sheet-swipe-units.css` の `.as-*` の部分と `sheet.html` を `index.html` に足す。
3. 行の量の表示（`.amt-pill`）のクリックで `openAmountSheetForEntry(id)` を呼ぶ（`integration-notes.md` 参照）。
4. 食品ごとの単位が必要なら `food-units.js`（単位の整形・解析・目安量画面の入力欄・AI/インポートの受け取り）と、内蔵DBの `db-units.json`（20食品）を足す。スワイプは `swipe-actions.js`。

### そのまま戻す場合
`snapshots/2026-11-03_with-amount-sheet.zip` の3ファイルで `app.js` / `index.html` / `foods-db.js` を置き換える。
- 戻る内容: 数量シート、左スワイプ、食品ごとの単位、内蔵DBの単位。
- 注意: この版は、2026-10-26の検索欄フォーカスの修正やCSVのTDEE列などは含んだ状態です。それ以降の変更（行の中の量の調整など）は失われます。

### 注意
- 数量シート版のテスト（`tests/amount-sheet.test.js`）は、撤去時に削除してしまい**保存できていません**。必要になった場合は、挙動の説明（`sheet.js` のコメントと `docs/archive` のこのREADME）から書き直してください。
- 撤去の理由: 日々の記録の速さが大事な場面で、別ウィンドウが重すぎた。現行は「行の中で量を調整する」方式です。

## スライダー版の量のUI（`old-amount-ui/`）

- `edit-form-amount.html.txt` … 編集フォームの量の操作（スライダー・±ボタン6個・小さじ/大さじ）
- `functions.js` … `syncAmountFromSlider` / `nudgeEditAmount` / `setEditAmountByVolume` と `recalcEdit`
- 出どころ: 最初にアップロードされた版。数量シートへ改修する直前のスナップショットは保存していませんが、この部分のコードは改修前後で変えていないため、同じ内容のはずです。
