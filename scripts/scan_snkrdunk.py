# -*- coding: utf-8 -*-
"""apparelページを連番スキャンしてタイトルからカードを照合、snkrdunk-ids.jsonに登録する。
検索ページがボットにトレンド固定を返すため、連番スキャン方式を採用。"""
import re, json, subprocess, time, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDS_FILE = os.path.join(ROOT, 'data', 'snkrdunk-ids.json')
DATA_FILE = os.path.join(ROOT, 'data', 'pokeca_data.json')
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

# 各セットコードのapparel ID密集帯（既知IDから推定）。必要に応じ拡張。
SET_RANGES = {
    'M2a': [(730800, 731080), (722230, 722250), (724990, 725000)],   # MEGAドリームex
    'M2':  [(704360, 704460)],                                       # インフェルノX
    'M4':  [(776300, 776430)],                                       # ニンジャスピナー
    'M5':  [(826520, 826600), (819800, 819860)],                     # アビスアイ
    'M3':  [(753242, 753276)],                                       # ムニキスゼロ（取りこぼし再取得）
}
CODE_TO_BOX = {'M2a': 'mega_dream_ex', 'M2': 'inferno_x', 'M4': 'ninja_spinner', 'M5': 'abyss_eye', 'M3': 'munikiss_zero'}
TARGET_RARITIES = {'SAR', 'MUR', 'MA', 'AR', 'SR'}

def get_title(aid):
    for _ in range(10):
        try:
            r = subprocess.run(['curl', '-s', '--max-time', '12', '-A', UA,
                                f'https://snkrdunk.com/apparels/{aid}'],
                               capture_output=True, timeout=16)
            out = r.stdout.decode('utf-8', 'replace')
            m = re.search(r'<title>([^<]*)</title>', out)
            if m and m.group(1).strip():
                return m.group(1).strip()
            if len(out) > 2000:  # ページはあるがタイトル空＝存在しないID等
                return None
        except Exception:
            pass
        time.sleep(0.8)
    return None

def parse_title(title):
    # "カード名 レアリティ [CODE NUM/TOTAL](セット名)の新品..."
    m = re.match(r'^(.+?)\s+(SAR|MUR|MA|AR|SR|UR|HR|RRR|RR|R|U|C)\s+\[([A-Za-z0-9]+)\s', title)
    if not m:
        return None
    return {'name': m.group(1).strip(), 'rarity': m.group(2), 'code': m.group(3)}

def main():
    ids = json.load(open(IDS_FILE, encoding='utf-8'))
    data = json.load(open(DATA_FILE, encoding='utf-8'))
    # (box_id, name, rarity) -> slug
    lookup = {}
    for c in data['cards']:
        if c['rarity'] in TARGET_RARITIES:
            lookup[(c['box_id'], c['card_name'], c['rarity'])] = c['id']
    registered_ids = set(ids.values())

    only = sys.argv[1] if len(sys.argv) > 1 else None  # 例: M2a
    found = 0
    for code, ranges in SET_RANGES.items():
        if only and code != only:
            continue
        box = CODE_TO_BOX[code]
        for (lo, hi) in ranges:
            print(f"\n=== スキャン {code} {lo}-{hi} ===", flush=True)
            for aid in range(lo, hi + 1):
                if aid in registered_ids:
                    continue
                title = get_title(aid)
                if not title:
                    continue
                p = parse_title(title)
                if not p or p['code'] != code:
                    continue
                slug = lookup.get((box, p['name'], p['rarity']))
                if slug and slug not in ids:
                    ids[slug] = aid
                    registered_ids.add(aid)
                    # 書き込み直前に最新を読み直してマージ（並行実行時の上書き消失を防止）
                    try:
                        disk = json.load(open(IDS_FILE, encoding='utf-8'))
                        disk.update(ids)
                        ids = disk
                    except Exception:
                        pass
                    json.dump(ids, open(IDS_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
                    print(f"  {aid} -> [{p['name']} {p['rarity']}] {slug}", flush=True)
                    found += 1
    print(f"\n完了: {found}件追加 / 合計 {len(ids)}件", flush=True)

if __name__ == '__main__':
    main()
