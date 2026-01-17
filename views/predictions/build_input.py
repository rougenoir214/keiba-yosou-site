import codecs
import os

# カレントディレクトリを設定
os.chdir(r'C:\Users\rouge\OneDrive\keiba-yosou-site\views\predictions')

# バックアップファイルから先頭420行を読み取る
with open('input.ejs.backup', 'r', encoding='utf-8') as f:
    lines = []
    for i, line in enumerate(f):
        if i < 420:
            lines.append(line)
        else:
            break

# JavaScript部分を読み取る
with open('input_bet_logic.js', 'r', encoding='utf-8') as f:
    js_logic = f.read()

# 新しいファイルを作成
with open('input.ejs', 'w', encoding='utf-8') as f:
    # 先頭420行を書き込む
    f.writelines(lines)
    
    # 閉じタグを追加
    f.write('</ul>\n')
    f.write('</div>\n')
    f.write('</div>\n')
    
    # Script開始
    f.write('<script>\n')
    
    # JavaScriptロジック
    f.write(js_logic)
    f.write('\n\n')
    
    # フォーム送信処理
    f.write('''
// 印の保存
document.getElementById('marks-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const marks = {};
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('mark_') && value) {
            marks[key.replace('mark_', '')] = value;
        }
    }
    try {
        const r = await fetch('/predictions/<%= race.race_id %>/marks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marks })
        });
        alert(r.ok ? '印を保存しました' : 'エラーが発生しました');
    } catch (error) { alert('エラーが発生しました'); }
});

// 馬券の追加
document.getElementById('bet-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const betType = document.getElementById('bet_type').value;
    const buyMethod = document.getElementById('buy_method_input').value;
    const horses = document.getElementById('horses_input').value;
    const betCount = parseInt(document.getElementById('bet_count').value) || 0;
    const amount = parseInt(document.getElementById('amount').value) || 100;

    if (!horses || betCount === 0) {
        alert('馬を選択してください');
        return;
    }

    const data = {
        bet_type: betType,
        horses: horses,
        amount: amount,
        buy_method: buyMethod,
        bet_count: betCount
    };

    try {
        const r = await fetch('/predictions/<%= race.race_id %>/bets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await r.json();
        if (r.ok) {
            alert(`馬券を追加しました（${betCount}点 × ${amount}円 = ${(betCount * amount).toLocaleString()}円）`);
            location.reload();
        } else {
            alert(result.error || 'エラーが発生しました');
        }
    } catch (error) { 
        console.error(error);
        alert('エラーが発生しました'); 
    }
});

// 馬券の削除
async function deleteBet(betId) {
    if (!confirm('この馬券を削除しますか？')) return;
    try {
        const r = await fetch(`/predictions/<%= race.race_id %>/bets/${betId}`, { method: 'DELETE' });
        if (r.ok) { 
            alert('馬券を削除しました'); 
            location.reload(); 
        } else { 
            alert('エラーが発生しました'); 
        }
    } catch (error) { 
        console.error(error);
        alert('エラーが発生しました'); 
    }
}
''')
    
    # Script終了とHTML終了
    f.write('</script>\n')
    f.write('</body>\n')
    f.write('</html>\n')

print("ファイルを作成しました")
