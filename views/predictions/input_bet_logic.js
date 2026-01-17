// 購入方法と馬券種別によるUI切り替え
function updateBuyMethod() {
    const betType = document.getElementById('bet_type').value;
    const buyMethod = document.querySelector('input[name="buy_method"]:checked').value;
    
    // 全ての入力エリアを非表示
    document.querySelectorAll('.bet-input-type').forEach(el => el.style.display = 'none');
    
    // チェックを全てリセット
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (!cb.name.startsWith('mark_')) cb.checked = false;
    });
    document.querySelectorAll('.horse-checkbox-label, .horse-checkbox-label-small').forEach(label => {
        label.classList.remove('selected');
    });
    
    // 隠しフィールドを更新
    document.getElementById('buy_method_input').value = buyMethod;
    
    // 対応する入力エリアを表示
    if (betType === 'tansho' || betType === 'fukusho') {
        document.getElementById('tanfuku-input').style.display = 'block';
    } else if (betType === 'umaren' || betType === 'wide') {
        if (buyMethod === 'normal') {
            document.getElementById('umaren-normal-input').style.display = 'block';
        } else if (buyMethod === 'box') {
            document.getElementById('umaren-box-input').style.display = 'block';
        }
    } else if (betType === 'umatan') {
        if (buyMethod === 'normal') {
            document.getElementById('umatan-normal-input').style.display = 'block';
        } else if (buyMethod === 'formation') {
            document.getElementById('umatan-formation-input').style.display = 'block';
        }
    } else if (betType === 'sanrenpuku') {
        if (buyMethod === 'normal') {
            document.getElementById('sanrenpuku-normal-input').style.display = 'block';
        } else if (buyMethod === 'box') {
            document.getElementById('sanrenpuku-box-input').style.display = 'block';
        } else if (buyMethod === 'formation') {
            document.getElementById('sanrenpuku-formation-input').style.display = 'block';
        }
    } else if (betType === 'sanrentan') {
        if (buyMethod === 'normal') {
            document.getElementById('sanrentan-normal-input').style.display = 'block';
        } else if (buyMethod === 'formation') {
            document.getElementById('sanrentan-formation-input').style.display = 'block';
        }
    }
    
    // 購入方法の選択肢を更新
    updateBuyMethodOptions();
}

// 馬券種別による購入方法選択肢の表示制御
function updateBuyMethodOptions() {
    const betType = document.getElementById('bet_type').value;
    const isTanFuku = betType === 'tansho' || betType === 'fukusho';
    const is2ren = betType === 'umaren' || betType === 'wide';
    const isUmatan = betType === 'umatan';
    const is3renpuku = betType === 'sanrenpuku';
    const is3rentan = betType === 'sanrentan';
    
    // ボックスとフォーメーションの表示制御
    document.getElementById('box-option').style.display = (is2ren || is3renpuku) ? 'flex' : 'none';
    document.getElementById('formation-option').style.display = (isUmatan || is3renpuku || is3rentan) ? 'flex' : 'none';
    
    // 単勝・複勝の場合は通常のみ
    if (isTanFuku) {
        document.querySelector('input[name="buy_method"][value="normal"]').checked = true;
    }
}

// 馬券種別変更時
document.getElementById('bet_type').addEventListener('change', function() {
    updateBuyMethodOptions();
    document.querySelector('input[name="buy_method"][value="normal"]').checked = true;
    updateBuyMethod();
});

// ラベルのハイライト処理（共通関数）
function highlightLabels(checkboxes, labelClass) {
    checkboxes.forEach(cb => {
        const label = cb.closest('.' + labelClass);
        if (label) {
            if (cb.checked) label.classList.add('selected');
            else label.classList.remove('selected');
        }
    });
}

// 単勝・複勝の選択処理
function updateTanfukuSelection() {
    const checkboxes = document.querySelectorAll('input[name="tanfuku_horse"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    
    // 1頭のみ選択可能
    if (checked.length > 1) {
        checked[0].checked = false;
    }
    
    highlightLabels(checkboxes, 'horse-checkbox-label');
    
    const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    document.getElementById('horses_input').value = selected.join(',');
    document.getElementById('bet_count').value = selected.length;
}

// 馬連・ワイド：通常
function updateUmarenNormalSelection() {
    const checkboxes = document.querySelectorAll('input[name="umaren_normal_horse"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    
    // 2頭のみ
    if (checked.length > 2) {
        checked[0].checked = false;
    }
    
    highlightLabels(checkboxes, 'horse-checkbox-label');
    
    const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    document.getElementById('horses_input').value = selected.join(',');
    document.getElementById('bet_count').value = selected.length === 2 ? 1 : 0;
}

// 馬連・ワイド：ボックス
function updateUmarenBoxSelection() {
    const checkboxes = document.querySelectorAll('input[name="umaren_box_horse"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    const n = checked.length;
    const count = n >= 2 ? (n * (n - 1)) / 2 : 0;
    
    highlightLabels(checkboxes, 'horse-checkbox-label');
    
    document.getElementById('horses_input').value = checked.map(cb => cb.value).join(',');
    document.getElementById('bet_count').value = count;
    document.getElementById('umaren-box-count').textContent = count + '点';
    const amount = parseInt(document.getElementById('amount').value) || 100;
    document.getElementById('umaren-box-amount').textContent = amount;
}

// 馬単：通常
function updateUmatanNormalSelection() {
    const first = document.querySelectorAll('input[name="umatan_normal_first"]');
    const second = document.querySelectorAll('input[name="umatan_normal_second"]');
    const firstChecked = Array.from(first).filter(cb => cb.checked);
    const secondChecked = Array.from(second).filter(cb => cb.checked);
    
    // 各1頭のみ
    if (firstChecked.length > 1) firstChecked[0].checked = false;
    if (secondChecked.length > 1) secondChecked[0].checked = false;
    
    highlightLabels(first, 'horse-checkbox-label');
    highlightLabels(second, 'horse-checkbox-label');
    
    const firstVals = Array.from(first).filter(cb => cb.checked).map(cb => cb.value);
    const secondVals = Array.from(second).filter(cb => cb.checked).map(cb => cb.value);
    
    const count = (firstVals.length === 1 && secondVals.length === 1 && firstVals[0] !== secondVals[0]) ? 1 : 0;
    
    document.getElementById('horses_input').value = firstVals.join(',') + '-' + secondVals.join(',');
    document.getElementById('bet_count').value = count;
}

// 馬単：フォーメーション
function updateUmatanFormationSelection() {
    const first = Array.from(document.querySelectorAll('input[name="umatan_form_first"]:checked'));
    const second = Array.from(document.querySelectorAll('input[name="umatan_form_second"]:checked'));
    
    let count = 0;
    first.forEach(f => {
        second.forEach(s => {
            if (f.value !== s.value) count++;
        });
    });
    
    highlightLabels(document.querySelectorAll('input[name="umatan_form_first"]'), 'horse-checkbox-label');
    highlightLabels(document.querySelectorAll('input[name="umatan_form_second"]'), 'horse-checkbox-label');
    
    document.getElementById('horses_input').value = first.map(f => f.value).join(',') + '-' + second.map(s => s.value).join(',');
    document.getElementById('bet_count').value = count;
    document.getElementById('umatan-form-count').textContent = count + '点';
    const amount = parseInt(document.getElementById('amount').value) || 100;
    document.getElementById('umatan-form-amount').textContent = amount;
}

// 3連複：通常
function updateSanrenpukuNormalSelection() {
    const checkboxes = document.querySelectorAll('input[name="sanrenpuku_normal_horse"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    
    // 3頭のみ
    if (checked.length > 3) {
        checked[0].checked = false;
    }
    
    highlightLabels(checkboxes, 'horse-checkbox-label');
    
    const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    document.getElementById('horses_input').value = selected.join(',');
    document.getElementById('bet_count').value = selected.length === 3 ? 1 : 0;
}

// 3連複：ボックス
function updateSanrenpukuBoxSelection() {
    const checkboxes = document.querySelectorAll('input[name="sanrenpuku_box_horse"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    const n = checked.length;
    const count = n >= 3 ? (n * (n - 1) * (n - 2)) / 6 : 0;
    
    highlightLabels(checkboxes, 'horse-checkbox-label');
    
    document.getElementById('horses_input').value = checked.map(cb => cb.value).join(',');
    document.getElementById('bet_count').value = count;
    document.getElementById('sanrenpuku-box-count').textContent = count + '点';
    const amount = parseInt(document.getElementById('amount').value) || 100;
    document.getElementById('sanrenpuku-box-amount').textContent = amount;
}

// 3連複：フォーメーション（3列それぞれから選んで組み合わせ）
function updateSanrenpukuFormationSelection() {
    const first = Array.from(document.querySelectorAll('input[name="sanrenpuku_form_first"]:checked'));
    const second = Array.from(document.querySelectorAll('input[name="sanrenpuku_form_second"]:checked'));
    const third = Array.from(document.querySelectorAll('input[name="sanrenpuku_form_third"]:checked'));
    
    // 3連複フォーメーション：各列から1頭ずつ選び、重複を除いた組み合わせをカウント
    let count = 0;
    const combinations = new Set();
    
    first.forEach(f => {
        second.forEach(s => {
            third.forEach(t => {
                const vals = [f.value, s.value, t.value];
                // 重複チェック
                if (new Set(vals).size === 3) {
                    // 3連複は順序関係なし、ソートして一意にする
                    const sorted = vals.sort((a, b) => a - b).join('-');
                    combinations.add(sorted);
                }
            });
        });
    });
    
    count = combinations.size;
    
    highlightLabels(document.querySelectorAll('input[name="sanrenpuku_form_first"]'), 'horse-checkbox-label-small');
    highlightLabels(document.querySelectorAll('input[name="sanrenpuku_form_second"]'), 'horse-checkbox-label-small');
    highlightLabels(document.querySelectorAll('input[name="sanrenpuku_form_third"]'), 'horse-checkbox-label-small');
    
    document.getElementById('horses_input').value = 
        first.map(f => f.value).join(',') + '-' + 
        second.map(s => s.value).join(',') + '-' + 
        third.map(t => t.value).join(',');
    document.getElementById('bet_count').value = count;
    document.getElementById('sanrenpuku-form-count').textContent = count + '点';
    const amount = parseInt(document.getElementById('amount').value) || 100;
    document.getElementById('sanrenpuku-form-amount').textContent = amount;
    document.getElementById('sanrenpuku-form-total').textContent = (count * amount).toLocaleString();
}

// 3連単：通常
function updateSanrentanNormalSelection() {
    const first = document.querySelectorAll('input[name="sanrentan_normal_first"]');
    const second = document.querySelectorAll('input[name="sanrentan_normal_second"]');
    const third = document.querySelectorAll('input[name="sanrentan_normal_third"]');
    
    const firstChecked = Array.from(first).filter(cb => cb.checked);
    const secondChecked = Array.from(second).filter(cb => cb.checked);
    const thirdChecked = Array.from(third).filter(cb => cb.checked);
    
    // 各1頭のみ
    if (firstChecked.length > 1) firstChecked[0].checked = false;
    if (secondChecked.length > 1) secondChecked[0].checked = false;
    if (thirdChecked.length > 1) thirdChecked[0].checked = false;
    
    highlightLabels(first, 'horse-checkbox-label-small');
    highlightLabels(second, 'horse-checkbox-label-small');
    highlightLabels(third, 'horse-checkbox-label-small');
    
    const firstVals = Array.from(first).filter(cb => cb.checked).map(cb => cb.value);
    const secondVals = Array.from(second).filter(cb => cb.checked).map(cb => cb.value);
    const thirdVals = Array.from(third).filter(cb => cb.checked).map(cb => cb.value);
    
    const vals = [...firstVals, ...secondVals, ...thirdVals];
    const count = (new Set(vals).size === 3 && vals.length === 3) ? 1 : 0;
    
    document.getElementById('horses_input').value = firstVals.join(',') + '-' + secondVals.join(',') + '-' + thirdVals.join(',');
    document.getElementById('bet_count').value = count;
}

// 3連単：フォーメーション
function updateSanrentanFormationSelection() {
    const first = Array.from(document.querySelectorAll('input[name="sanrentan_form_first"]:checked'));
    const second = Array.from(document.querySelectorAll('input[name="sanrentan_form_second"]:checked'));
    const third = Array.from(document.querySelectorAll('input[name="sanrentan_form_third"]:checked'));
    
    // 3連単フォーメーション：重複を除いた組み合わせ数
    let count = 0;
    first.forEach(f => {
        second.forEach(s => {
            if (f.value !== s.value) {
                third.forEach(t => {
                    if (t.value !== f.value && t.value !== s.value) {
                        count++;
                    }
                });
            }
        });
    });
    
    highlightLabels(document.querySelectorAll('input[name="sanrentan_form_first"]'), 'horse-checkbox-label-small');
    highlightLabels(document.querySelectorAll('input[name="sanrentan_form_second"]'), 'horse-checkbox-label-small');
    highlightLabels(document.querySelectorAll('input[name="sanrentan_form_third"]'), 'horse-checkbox-label-small');
    
    document.getElementById('horses_input').value = 
        first.map(f => f.value).join(',') + '-' + 
        second.map(s => s.value).join(',') + '-' + 
        third.map(t => t.value).join(',');
    document.getElementById('bet_count').value = count;
    document.getElementById('sanrentan-form-count').textContent = count + '点';
    const amount = parseInt(document.getElementById('amount').value) || 100;
    document.getElementById('sanrentan-form-amount').textContent = amount;
    document.getElementById('sanrentan-form-total').textContent = (count * amount).toLocaleString();
}

// 金額変更時の再計算
document.getElementById('amount').addEventListener('input', function() {
    const betType = document.getElementById('bet_type').value;
    const buyMethod = document.querySelector('input[name="buy_method"]:checked').value;
    
    if (buyMethod === 'box' && (betType === 'umaren' || betType === 'wide')) {
        updateUmarenBoxSelection();
    } else if (buyMethod === 'formation' && betType === 'umatan') {
        updateUmatanFormationSelection();
    } else if (buyMethod === 'box' && betType === 'sanrenpuku') {
        updateSanrenpukuBoxSelection();
    } else if (buyMethod === 'formation' && betType === 'sanrenpuku') {
        updateSanrenpukuFormationSelection();
    } else if (buyMethod === 'formation' && betType === 'sanrentan') {
        updateSanrentanFormationSelection();
    }
});

// 初期表示
document.getElementById('tanfuku-input').style.display = 'block';
updateBuyMethodOptions();
