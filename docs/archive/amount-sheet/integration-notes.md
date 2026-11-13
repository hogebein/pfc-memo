# 数量シート版の組み込み箇所（2026-11-03時点）

元のコード上でシートがつながっていた場所です。

### 記録の行: 量の表示（ピル）をタップでシートを開く
```js
html += `<div class="log-item${isGrp ? ' grp' : ''}" data-eid="${e.id}"><div${isGrp ? ` onclick="toggleGroupOpen(${e.id})" style="cursor:pointer"` : ''}><div class="li-name">${isGrp ? '🗂 ' : ''}${fdEsc(e.name)}${isGrp ? ` <span class="fd-badge">${e.ingredients.length}品 ${open ? '▾' : '▸'}</span>` : ''}</div><div class="li-detail"><span class="amt-pill" onclick="event.stopPropagation();openAmountSheetForEntry(${e.id})" role="button" aria-label="量を変更">${fmtAmt(e.amount)}g</span>｜P${r1(e.p)} F${r1(e.f)} C${r1(e.c)}${e.fiber?'｜繊'+r1(e.fiber):''}${e.vitd?'｜D'+r1(e.vitd)+'μg':''}</div></div>
```

### 記録の行: スワイプで出す「複製／削除」
```js
<div class="sw-actions"><button type="button" class="btn btn-sm" onclick="duplicateEntry(${e.id})">複製</button><button type="button" class="btn btn-sm btn-danger" onclick="deleteEntry(${e.id})">削除</button></div></div>`;
```

### 編集フォーム: 「量を変更」ボタン
```js
<div class="row" style="margin-bottom:6px"><button type="button" class="btn btn-sm" style="flex:1;height:40px;font-size:13px" onclick="openAmountSheetForEntry(${e.id})">📏 量を変更（倍率・単位・数字キー）</button></div>
```

### 編集フォーム: 複製／削除ボタン
```js
<button type="button" class="btn btn-sm" onclick="duplicateEntry(${e.id})" style="flex:1;height:32px">複製</button>
```

