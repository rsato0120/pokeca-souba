import json

data = json.load(open('data/pokeca_data.json', encoding='utf-8'))

# --- Box ---
new_box = {
  "box_id": "mega_brave",
  "box_name": "メガブレイブ",
  "code": "M1",
  "release_ym": "2025-08",
  "certainty": "released",
  "pack_price_yen": 180,
  "packs_per_box": 30,
  "note": "2025-08-01発売。MEGAシリーズ第1弾。メガルカリオex/メガフシギバナex/メガアブソルex/メガクチートex/メガバクーダexを収録。メガシンフォニアと同時発売。"
}
# 未発売の storm_emeralda の前に挿入（released群の末尾）
idx = next((i for i, b in enumerate(data['boxes']) if b['box_id'] == 'storm_emeralda'), len(data['boxes']))
data['boxes'].insert(idx, new_box)

# --- Card builder ---
def img(no):
    return f"https://www.pokeca.net/data/pokeca/product/m1l/{int(no):03d}.jpg"

def cn(no):
    return f"{int(no):03d}/063"

REG = "I"

def card(id_, no, rarity, name, type_, stage, hp, comp, char_pop,
         illust="unknown", illust_pop="unknown", note="", evidence_p="", evidence_c="", img_override=None):
    return {
        "id": id_,
        "card_no": cn(no),
        "rarity": rarity,
        "card_name": name,
        "box_id": "mega_brave",
        "is_reprint": False,
        "image_url": img_override or img(no),
        "card_spec": {"type": type_, "stage": stage, "hp": hp, "note": note},
        "materials": {
            "player": {"regulation_mark": REG, "rotation": "far", "competitive_usage": comp},
            "collector": {"illustrator": illust, "illustrator_popularity": illust_pop, "artwork_type": "original", "rarity": rarity},
            "common": {"reprint_status": "none", "scarcity": "normal", "character_popularity": char_pop}
        },
        "evidence_notes": {
            "player": evidence_p or f"{name}の競技採用状況。",
            "collector": evidence_c or f"{name} {rarity}のコレクター需要。",
            "source": "各カードDB/相場サイト（2025-08〜）"
        },
        "note": f"{rarity}版。"
    }

MUR_LUCARIO = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/M1L/M1L_92_R_JP_LG.png"

new_cards = [
    # ---- SR メガシンカex (5) ----
    card("mega-brave-mega-venusaur-ex-sr", 76, "SR", "メガフシギバナex", "草", "メガシンカex", 330, "mid", "high",
         note="SR版。初代御三家フシギバナのメガシンカex。",
         evidence_p="草タイプのメガシンカex。競技採用mid。",
         evidence_c="人気の初代御三家フシギバナのSR版。コレクター需要high。"),
    card("mega-brave-mega-camerupt-ex-sr", 77, "SR", "メガバクーダex", "炎", "メガシンカex", 330, "low", "mid",
         note="SR版。炎・地のメガシンカex。",
         evidence_p="炎タイプのメガシンカex。競技採用low。",
         evidence_c="メガバクーダexのSR版。コレクター需要mid。"),
    card("mega-brave-mega-lucario-ex-sr", 78, "SR", "メガルカリオex", "闘", "メガシンカex", 330, "mid", "high",
         note="SR版。メガブレイブの看板格。闘タイプのメガシンカex。",
         evidence_p="闘タイプのメガシンカex。競技採用mid。",
         evidence_c="人気最高峰ルカリオのSR版。コレクター需要high。"),
    card("mega-brave-mega-absol-ex-sr", 79, "SR", "メガアブソルex", "悪", "メガシンカex", 280, "mid", "high",
         note="SR版。悪タイプのメガシンカex。",
         evidence_p="悪タイプのメガシンカex。競技採用mid。",
         evidence_c="人気のアブソルのSR版。コレクター需要high。"),
    card("mega-brave-mega-mawile-ex-sr", 80, "SR", "メガクチートex", "鋼", "メガシンカex", 300, "low", "mid",
         note="SR版。鋼タイプのメガシンカex。",
         evidence_p="鋼タイプのメガシンカex。競技採用low。",
         evidence_c="メガクチートexのSR版。コレクター需要mid。"),

    # ---- SAR (5) ----
    card("mega-brave-mega-venusaur-ex-sar", 87, "SAR", "メガフシギバナex", "草", "メガシンカex", 330, "mid", "high",
         note="SAR版。描き下ろし特殊イラスト。メガシンフォニアのカードと並べて繋がる構図。",
         evidence_p="草メガシンカexのSAR版。競技採用mid。",
         evidence_c="初代御三家フシギバナの描き下ろしSAR。人気×SAR希少性で高額。"),
    card("mega-brave-mega-lucario-ex-sar", 88, "SAR", "メガルカリオex", "闘", "メガシンカex", 330, "mid", "high",
         note="SAR版。描き下ろし特殊イラスト。メガブレイブの目玉SAR。",
         evidence_p="闘メガシンカexのSAR版。競技採用mid。",
         evidence_c="人気最高峰ルカリオの描き下ろしSAR。メガブレイブのトップ価格帯。"),
    card("mega-brave-mega-absol-ex-sar", 89, "SAR", "メガアブソルex", "悪", "メガシンカex", 280, "mid", "high",
         note="SAR版。描き下ろし特殊イラスト。",
         evidence_p="悪メガシンカexのSAR版。競技採用mid。",
         evidence_c="人気のアブソルの描き下ろしSAR。コレクター需要high。"),
    card("mega-brave-matis-no-torihiki-sar", 90, "SAR", "マチスの取引", "サポート", "サポート", 0, "mid", "mid",
         note="SAR版。サポートの描き下ろしイラスト。",
         evidence_p="サポートカードのSAR版。採用率mid。",
         evidence_c="マチスの取引のSAR描き下ろし。コレクター需要mid。"),
    card("mega-brave-lillie-determination-sar", 91, "SAR", "リーリエの決心", "サポート", "サポート", 0, "mid", "high",
         note="SAR版。人気キャラ「リーリエ」の描き下ろしサポートSAR。",
         evidence_p="サポートカードのSAR版。採用率mid。",
         evidence_c="人気キャラ・リーリエの描き下ろしSAR。キャラ人気×SAR希少性で高額。"),

    # ---- MUR (1) ----
    card("mega-brave-mega-lucario-ex-mur", 92, "MUR", "メガルカリオex", "闘", "メガシンカex", 330, "mid", "high",
         note="MUR（最高レアリティ）版。ミラー加工の超希少枠。メガブレイブの最高峰。",
         evidence_p="闘メガシンカexのMUR版。競技採用mid。",
         evidence_c="メガブレイブ最高峰レアリティ。ルカリオ人気×MUR極稀少で非常に高額。",
         img_override=MUR_LUCARIO),

    # ---- AR (7) ----
    card("mega-brave-bulbasaur-ar", 64, "AR", "フシギダネ", "草", "基本", 70, "none", "high",
         note="AR特殊イラスト版。初代御三家の基本ポケモン。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="人気の初代御三家フシギダネのAR版。キャラ人気highでコレクター需要high。"),
    card("mega-brave-ivysaur-ar", 65, "AR", "フシギソウ", "草", "1進化", 100, "none", "high",
         note="AR特殊イラスト版。フシギダネの進化形。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="フシギソウのAR版。初代御三家ラインで人気high。"),
    card("mega-brave-vulpix-ar", 67, "AR", "ロコン", "炎", "基本", 70, "none", "high",
         note="AR特殊イラスト版。人気の炎タイプ基本ポケモン。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="人気ポケモン・ロコンのAR版。キャラ人気highでコレクター需要high。"),
    card("mega-brave-riolu-ar", 68, "AR", "リオル", "闘", "基本", 70, "none", "high",
         note="AR特殊イラスト版。ルカリオの進化前。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="人気のルカリオ進化前リオルのAR版。キャラ人気highでコレクター需要high。"),
    card("mega-brave-marshadow-ar", 69, "AR", "マーシャドー", "闘", "基本", 90, "none", "mid",
         note="AR特殊イラスト版。幻のポケモン。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="幻のポケモン・マーシャドーのAR版。コレクター需要mid。"),
    card("mega-brave-spiritomb-ar", 71, "AR", "ミカルゲ", "悪", "基本", 80, "none", "mid",
         note="AR特殊イラスト版。悪タイプの基本ポケモン。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="ミカルゲのAR特殊イラスト版。コレクター需要mid。"),
    card("mega-brave-steelix-ar", 73, "AR", "ハガネール", "鋼", "1進化", 150, "none", "mid",
         note="AR特殊イラスト版。イワークの進化形。鋼タイプ。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="ハガネールのAR特殊イラスト版。コレクター需要mid。"),
]

data['cards'].extend(new_cards)

json.dump(data, open('data/pokeca_data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f"完了: boxes={len(data['boxes'])}, cards={len(data['cards'])}")
print(f"追加カード: {len(new_cards)}枚")
