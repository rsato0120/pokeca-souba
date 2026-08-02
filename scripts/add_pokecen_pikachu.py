# -*- coding: utf-8 -*-
"""ポケモンセンター限定 ご当地ピカチュウ プロモ3種を1カテゴリ(box)として追加。
トウホク260 / ヒロシマ261 / フクオカ289（いずれもSV-P PROMO・スペシャルBOX収録）。"""
import json

data = json.load(open('data/pokeca_data.json', encoding='utf-8'))

BOX_ID = 'pokecen_pikachu'

# --- Box（収録弾ではなくプロモ・カテゴリ。packs_per_box無し＝未開封BOX相場の対象外）---
new_box = {
    "box_id": BOX_ID,
    "box_name": "ポケモンセンター限定ピカチュウ",
    "code": "SV-P",
    "release_ym": "2025-08",
    "certainty": "released",
    "pack_price_yen": 2090,
    "note": "ポケモンセンター（トウホク/ヒロシマ/フクオカ）リニューアル記念スペシャルBOX収録のご当地ピカチュウプロモ。ポケモンセンターオンラインの抽選販売限定で、定価2,090円のスペシャルBOXに1枚封入。"
}
# released群の末尾（未発売 storm_emeralda の前）に挿入
idx = next((i for i, b in enumerate(data['boxes']) if b['box_id'] == 'storm_emeralda'), len(data['boxes']))
data['boxes'].insert(idx, new_box)


def img(no):
    return f"https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SVP/SVP_{no}_R_JP_LG.png"


def card(id_, no, name, region, art):
    return {
        "id": id_,
        "card_no": f"{no}/SV-P",
        "rarity": "PROMO",
        "card_name": name,
        "box_id": BOX_ID,
        "is_reprint": False,
        "image_url": img(no),
        "card_spec": {"type": "雷", "stage": "基本", "hp": 70,
                      "note": f"{region}をテーマにした描き下ろしご当地ピカチュウ。プロモ（SV-P {no}）。"},
        "materials": {
            "player": {"regulation_mark": "—", "rotation": "far", "competitive_usage": "none"},
            "collector": {"illustrator": "unknown", "illustrator_popularity": "unknown",
                          "artwork_type": "original", "rarity": "PROMO"},
            "common": {"reprint_status": "none", "scarcity": "scarce", "character_popularity": "high"}
        },
        "evidence_notes": {
            "player": "競技用途なし（コレクター向けプロモ）。",
            "collector": f"{art} 抽選限定で供給が絞られ、ピカチュウ人気×ご当地描き下ろしで高額。定価2,090円に対し高騰実績あり。",
            "source": "ポケカ公式(info/005053)、各相場サイト（2025-08〜）"
        },
        "note": f"{region}のポケモンセンター リニューアル記念スペシャルBOX収録プロモ。"
    }


new_cards = [
    card("pokecen-pikachu-tohoku", "260", "トウホクのピカチュウ", "東北",
         "東北地方のお祭りをイメージしたアート。"),
    card("pokecen-pikachu-hiroshima", "261", "ヒロシマのピカチュウ", "広島",
         "広島の街を楽しむピカチュウたちのアート。"),
    card("pokecen-pikachu-fukuoka", "289", "フクオカのピカチュウ", "福岡",
         "福岡のグルメフェスをイメージしたアート。"),
]

data['cards'].extend(new_cards)

json.dump(data, open('data/pokeca_data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f"完了: boxes={len(data['boxes'])}, cards={len(data['cards'])}")
print(f"追加カード: {len(new_cards)}枚 / box={BOX_ID}")
