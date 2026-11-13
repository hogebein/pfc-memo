// 【アーカイブ】単体では実行できない断片です。当時の app.js（最初にアップロードされた版）から抜き出したものです。
// 再利用するときは README.md の「戻し方」を参照してください。

function syncAmountFromSlider(id, val) {
  const amtEl = document.getElementById('ea'+id);
  if (!amtEl) return;
  amtEl.value = val;
  recalcEdit(id);
}
function nudgeEditAmount(id, delta) {
  const amtEl = document.getElementById('ea'+id);
  if (!amtEl) return;
  const cur = parseFloat(amtEl.value) || 0;
  amtEl.value = Math.max(0.1, r1(cur + delta));
  recalcEdit(id);
}
// 小さじ(5ml)・大さじ(15ml)から量(g)を設定する。食品DBに密度(density)があればそれを使い、
// 無ければ水とほぼ同じ1.0g/mlとして概算する
function setEditAmountByVolume(id, ml) {
  const nameEl = document.getElementById('en'+id);
  const density = getFoodDensity(nameEl ? nameEl.value.trim() : '');
  const amtEl = document.getElementById('ea'+id);
  if (!amtEl) return;
  amtEl.value = r1(ml * density);
  recalcEdit(id);
}

// ── recalcEdit（量の変更をその場で記録に反映する。スライダーとの同期を含む）──
function recalcEdit(id) {
  const base = window._editBase && window._editBase[id];
  if (!base) return;
  const amt = parseFloat(document.getElementById('ea'+id).value) || 0;
  if (amt <= 0) return;
  const sliderEl = document.getElementById('easlider'+id);
  if (sliderEl) {
    if (amt > parseFloat(sliderEl.max)) sliderEl.max = amt; // 大きい値を直接入力された場合はスライダーの上限を追従させる
    sliderEl.value = amt;
  }
  const r = amt / (base.per || 100);
  const set = (elId, val, dec) => {
    const el = document.getElementById(elId+id);
    if (el) el.value = dec === 2 ? r2(val*r) : r1(val*r);
  };
  set('ec', base.cal);
  set('ep', base.p);
  set('ef', base.f);
  set('ecc', base.c);
  set('efib', base.fiber);
  set('efe', base.iron);
  set('eca', base.calcium);
  set('evc', base.vitc);
  set('evd', base.vitd);
  set('esl', base.salt, 2);
  // 複合食品の記録なら、全体量の変更に合わせて材料の分量(g)も同じ比率でスケールする
  // （編集を開始した時点の材料構成＝base.ingredients を常に基準にして計算し、誤差の蓄積を防ぐ）
  if (base.ingredients && base.ingredients.length) {
    const entryIdx = entries.findIndex(en => en.id === id);
    if (entryIdx !== -1 && entries[entryIdx].ingredients) {
      entries[entryIdx].ingredients = base.ingredients.map((ing, i) => ({ ...ing, amount: r1((ing.amount || 0) * r) }));
      base.ingredients.forEach((ing, i) => {
        const ingEl = document.getElementById(`eIng${id}_${i}`);
        if (ingEl) ingEl.value = r1((ing.amount || 0) * r);
      });
      const totalLineEl = document.getElementById('editIngTotal'+id);
      if (totalLineEl) totalLineEl.textContent = `合計 ${ri(base.cal*r)}kcal P${r1(base.p*r)} F${r1(base.f*r)} C${r1(base.c*r)}${base.fiber ? ' 繊'+r1(base.fiber*r)+'g' : ''}`;
    }
  }
  autoSaveEdit(id);
}
