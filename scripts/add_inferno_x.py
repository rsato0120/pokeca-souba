import json

data = json.load(open('data/pokeca_data.json', encoding='utf-8'))

# --- Box ---
new_box = {
  "box_id": "inferno_x",
  "box_name": "インフェルノX",
  "code": "M2",
  "release_ym": "2025-09",
  "certainty": "released",
  "pack_price_yen": 180,
  "packs_per_box": 30,
  "pack_image_url": "https://archives.bulbagarden.net/media/upload/e/e0/M2_Inferno_X_pack.png",
  "note": "2025-09-26発売。メガリザードンXexが目玉の炎・悪タイプ強化弾。"
}
idx = next(i for i, b in enumerate(data['boxes']) if b['box_id'] == 'storm_emeralda')
data['boxes'].insert(idx, new_box)

# --- Card builder ---
def img(no):
    return f"https://www.pokeca.net/data/pokeca/product/m2in/{int(no):03d}.jpg"

def cn(no):
    return f"{int(no):03d}/080"

REG = "I"

def card(id_, no, rarity, name, type_, stage, hp, comp, char_pop,
         illust="unknown", illust_pop="unknown", note="", evidence_p="", evidence_c=""):
    return {
        "id": id_,
        "card_no": cn(no),
        "rarity": rarity,
        "card_name": name,
        "box_id": "inferno_x",
        "is_reprint": False,
        "image_url": img(no),
        "card_spec": {"type": type_, "stage": stage, "hp": hp, "note": note},
        "materials": {
            "player": {"regulation_mark": REG, "rotation": "far", "competitive_usage": comp},
            "collector": {"illustrator": illust, "illustrator_popularity": illust_pop, "artwork_type": "original", "rarity": rarity},
            "common": {"reprint_status": "none", "scarcity": "normal", "character_popularity": char_pop}
        },
        "evidence_notes": {
            "player": evidence_p or f"{name}の競技採用状況。",
            "collector": evidence_c or f"{name} {rarity}のコレクター需要。",
            "source": "各カードDB/相場サイト（2025-09〜）"
        },
        "note": f"{rarity}版。"
    }

new_cards = [
    # ---- RR (8) ----
    card("inferno-x-mega-heracross-ex-rr", 4, "RR", "メガヘラクロスex", "草", "メガシンカex", 280, "low", "mid",
         note="ワザ「パンツァーホーン」で受けたダメージ分を上乗せ攻撃。",
         evidence_p="草タイプのメガシンカex。競技採用は限定的。",
         evidence_c="メガヘラクロスexのRRホロ版。コレクター需要mid。"),
    card("inferno-x-mega-charizard-x-ex-rr", 13, "RR", "メガリザードンXex", "炎", "メガシンカex", 360, "high", "high",
         note="ワザ「インフェルノX」で炎エネルギーをトラッシュして大ダメージ。環境トップ級。",
         evidence_p="環境最強格のメガシンカex。炎デッキの主軸として広く採用。",
         evidence_c="人気最高峰のリザードンXex RR。コレクター需要も高い。"),
    card("inferno-x-oricorio-ex-rr", 18, "RR", "オドリドリex", "炎", "基本ex", 160, "mid", "mid",
         note="特性「エキサイトターボ」で炎エネルギーを加速。サポート役。",
         evidence_p="炎デッキのエネルギー加速要員。採用率mid。",
         evidence_c="オドリドリexのRRホロ版。コレクター需要mid。"),
    card("inferno-x-rotom-ex-rr", 29, "RR", "ロトムex", "雷", "基本ex", 130, "mid", "high",
         note="特性でドロー加速。汎用性の高いサポートex。",
         evidence_p="汎用ドローサポートexとして採用率mid。",
         evidence_c="人気キャラのロトムex RRホロ版。コレクター需要high。"),
    card("inferno-x-mismagius-ex-rr", 36, "RR", "ムウマージex", "超", "基本ex", 120, "low", "mid",
         note="超タイプのサポートex。",
         evidence_p="超タイプex。競技採用はlow。",
         evidence_c="ムウマージexのRRホロ版。コレクター需要mid。"),
    card("inferno-x-mega-sharpedo-ex-rr", 51, "RR", "メガサメハダーex", "水", "メガシンカex", 290, "mid", "mid",
         note="水タイプのメガシンカex。高HPと火力を兼備。",
         evidence_p="水タイプメガシンカex。採用率mid。",
         evidence_c="メガサメハダーexのRRホロ版。コレクター需要mid。"),
    card("inferno-x-empoleon-ex-rr", 58, "RR", "エンペルトex", "水", "基本ex", 230, "mid", "mid",
         note="特性「こうていのかまえ」で相手のワザ効果を無効化。",
         evidence_p="防御特性持ちエンペルトex。採用率mid。",
         evidence_c="人気スターターエンペルトのexRR版。コレクター需要mid。"),
    card("inferno-x-mega-lopunny-ex-rr", 72, "RR", "メガミミロップex", "無", "メガシンカex", 330, "mid", "mid",
         note="無タイプの高HP330メガシンカex。",
         evidence_p="メガミミロップex。無タイプで汎用性あり。採用率mid。",
         evidence_c="メガミミロップexのRRホロ版。コレクター需要mid。"),

    # ---- AR (12) ----
    card("inferno-x-ludicolo-ar", 81, "AR", "ルンパッパ", "草", "2進化", 160, "none", "mid",
         note="ハスボー→ハスブレロ→ルンパッパの最終進化。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="ルンパッパのAR特殊イラスト版。コレクター需要mid。"),
    card("inferno-x-nymble-ar", 82, "AR", "マメバッタ", "草", "基本", 60, "none", "unknown",
         note="パルデア地方の小型虫ポケモン。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="マメバッタのAR特殊イラスト版。"),
    card("inferno-x-rolycoly-ar", 83, "AR", "カルボウ", "無", "基本", 60, "none", "unknown",
         note="石炭をモチーフにした基本ポケモン。インフェルノX炎テーマに合致。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="カルボウのAR特殊イラスト版。"),
    card("inferno-x-dewgong-ar", 84, "AR", "ジュゴン", "水", "1進化", 130, "none", "mid",
         note="パウワウの進化形。水タイプの1進化ポケモン。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="ジュゴンのAR特殊イラスト版。コレクター需要mid。"),
    card("inferno-x-piplup-ar", 85, "AR", "ポッチャマ", "水", "基本", 70, "none", "high",
         note="エンペルトの基本形。人気の高い水タイプスターター。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="人気スターターポッチャマのAR版。character_popularity=highでコレクター需要high。"),
    card("inferno-x-yamper-ar", 86, "AR", "ワンパチ", "雷", "基本", 70, "none", "mid",
         note="雷タイプのかわいい犬ポケモン。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="ワンパチのAR特殊イラスト版。コレクター需要mid。"),
    card("inferno-x-zacian-ar", 87, "AR", "ザシアン", "金", "基本", 130, "none", "high",
         note="伝説の剣ポケモン。金タイプ（鋼）の基本ポケモン。",
         evidence_p="AR枠の伝説ポケモン。競技採用なし。",
         evidence_c="人気伝説ポケモンのAR版。character_popularity=highでコレクター需要high。"),
    card("inferno-x-flygon-ar", 88, "AR", "フライゴン", "無", "2進化", 130, "none", "high",
         note="ナックラー→ビブラーバ→フライゴンの最終進化。人気のドラゴン系ポケモン。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="人気ドラゴンポケモンのAR版。character_popularity=highでコレクター需要high。"),
    card("inferno-x-toxtricity-ar", 89, "AR", "ストリンダー", "悪", "1進化", 110, "none", "mid",
         note="シビルドンの進化形。悪タイプのロック系ポケモン。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="ストリンダーのAR特殊イラスト版。コレクター需要mid。"),
    card("inferno-x-togedemaru-ar", 90, "AR", "トゲデマル", "雷", "基本", 70, "none", "mid",
         note="丸くてかわいい雷タイプのハリネズミポケモン。",
         evidence_p="AR枠の基本ポケモン。競技採用なし。",
         evidence_c="トゲデマルのAR特殊イラスト版。コレクター需要mid。"),
    card("inferno-x-wigglytuff-ar", 91, "AR", "プクリン", "無", "1進化", 150, "none", "high",
         note="プリンの進化形。高HPの無タイプポケモン。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="人気ポケモンプクリンのAR版。character_popularity=highでコレクター需要high。"),
    card("inferno-x-ambipom-ar", 92, "AR", "エテボース", "無", "1進化", 110, "none", "mid",
         note="エテボースのAR版。無タイプの1進化ポケモン。",
         evidence_p="AR枠の進化ポケモン。競技採用なし。",
         evidence_c="エテボースのAR特殊イラスト版。コレクター需要mid。"),

    # ---- SR Pokemon (8) + SR Trainer (1) ----
    card("inferno-x-mega-heracross-ex-sr", 93, "SR", "メガヘラクロスex", "草", "メガシンカex", 280, "low", "mid",
         note="SR版。RRと同スペック、異イラスト。",
         evidence_p="競技採用はlow。SR版はホロfoil加工でコレクター向け。",
         evidence_c="メガヘラクロスexのSR版。RRより希少性高め。"),
    card("inferno-x-mega-charizard-x-ex-sr", 94, "SR", "メガリザードンXex", "炎", "メガシンカex", 360, "high", "high",
         note="SR版。環境最強格。SAR/MURも存在。",
         evidence_p="環境最強格のSR版。競技採用=high。",
         evidence_c="人気最高峰SRリザードンXex。SAR・MUR・RRと並ぶコレクターの対象。"),
    card("inferno-x-oricorio-ex-sr", 95, "SR", "オドリドリex", "炎", "基本ex", 160, "mid", "mid",
         note="SR版。エネルギー加速特性持ち。",
         evidence_p="炎デッキのエネルギー加速要員SR版。採用率mid。",
         evidence_c="オドリドリexのSR版。"),
    card("inferno-x-rotom-ex-sr", 96, "SR", "ロトムex", "雷", "基本ex", 130, "mid", "high",
         note="SR版。汎用ドローサポートex。",
         evidence_p="汎用ドローexのSR版。採用率mid。",
         evidence_c="人気キャラロトムexのSR版。コレクター需要high。"),
    card("inferno-x-mismagius-ex-sr", 97, "SR", "ムウマージex", "超", "基本ex", 120, "low", "mid",
         note="SR版。超タイプのサポートex。",
         evidence_p="超タイプexのSR版。競技採用low。",
         evidence_c="ムウマージexのSR版。"),
    card("inferno-x-mega-sharpedo-ex-sr", 98, "SR", "メガサメハダーex", "水", "メガシンカex", 290, "mid", "mid",
         note="SR版。水タイプの高HPメガシンカex。",
         evidence_p="水タイプメガシンカexのSR版。採用率mid。",
         evidence_c="メガサメハダーexのSR版。"),
    card("inferno-x-empoleon-ex-sr", 99, "SR", "エンペルトex", "水", "基本ex", 230, "mid", "mid",
         note="SR版。防御特性持ち。",
         evidence_p="防御特性持ちエンペルトexのSR版。採用率mid。",
         evidence_c="人気スターターexのSR版。コレクター需要mid。"),
    card("inferno-x-mega-lopunny-ex-sr", 100, "SR", "メガミミロップex", "無", "メガシンカex", 330, "mid", "mid",
         note="SR版。無タイプ高HPメガシンカex。",
         evidence_p="無タイプメガシンカexのSR版。採用率mid。",
         evidence_c="メガミミロップexのSR版。"),
    card("inferno-x-hikari-sr", 106, "SR", "ヒカリ", "サポート", "サポート", 0, "high", "high",
         note="強力なサポートカードのSR版。炎デッキのエネルギー加速サポート。",
         evidence_p="環境デッキで広く採用されるサポートのSR版。採用率high。",
         evidence_c="人気キャラ「ヒカリ」のSR版。SAR版（115）のほうが高額だがSR版も需要あり。"),

    # ---- SAR (6) ----
    card("inferno-x-mega-charizard-x-ex-sar", 110, "SAR", "メガリザードンXex", "炎", "メガシンカex", 360, "high", "high",
         illust="だんちゃお", illust_pop="high",
         note="SAR版。進化ラインが集合した青炎イラストで人気最高峰。",
         evidence_p="SR版と同スペック。競技採用=high。",
         evidence_c="だんちゃお氏描き下ろしSARイラスト。リザードンX人気×SARレアリティで超高額。"),
    card("inferno-x-oricorio-ex-sar", 111, "SAR", "オドリドリex", "炎", "基本ex", 160, "mid", "mid",
         note="SAR版。特殊アートの描き下ろしイラスト。",
         evidence_p="エネルギー加速要員のSAR版。採用率mid。",
         evidence_c="オドリドリexのSAR版。描き下ろしイラストでコレクター需要。"),
    card("inferno-x-rotom-ex-sar", 112, "SAR", "ロトムex", "雷", "基本ex", 130, "mid", "high",
         note="SAR版。特殊アート描き下ろし。",
         evidence_p="汎用ドローexのSAR版。採用率mid。",
         evidence_c="人気キャラロトムexのSAR版。コレクター需要high。"),
    card("inferno-x-mega-sharpedo-ex-sar", 113, "SAR", "メガサメハダーex", "水", "メガシンカex", 290, "mid", "mid",
         note="SAR版。特殊アート描き下ろし。",
         evidence_p="水タイプメガシンカexのSAR版。採用率mid。",
         evidence_c="メガサメハダーexのSAR版。"),
    card("inferno-x-mega-lopunny-ex-sar", 114, "SAR", "メガミミロップex", "無", "メガシンカex", 330, "mid", "mid",
         note="SAR版。特殊アート描き下ろし。",
         evidence_p="無タイプメガシンカexのSAR版。採用率mid。",
         evidence_c="メガミミロップexのSAR版。"),
    card("inferno-x-hikari-sar", 115, "SAR", "ヒカリ", "サポート", "サポート", 0, "high", "high",
         note="SAR版。インフェルノXの最高額カードの一つ。人気キャラ×SAR希少性で超高額。",
         evidence_p="環境サポートのSAR版。採用率high。",
         evidence_c="ヒカリSARはインフェルノXトップ価格帯。人気キャラ×SAR希少性で需要extremely high。"),

    # ---- MUR (1) ----
    card("inferno-x-mega-charizard-x-ex-mur", 116, "MUR", "メガリザードンXex", "炎", "メガシンカex", 360, "high", "high",
         note="MUR（メガウルトラレア）版。ミラー加工の最高レアリティ。50BOXに1枚の超希少。",
         evidence_p="SR版と同スペック。競技採用=high。",
         evidence_c="インフェルノXの最高峰レアリティ。リザードンX人気×MUR極稀少で非常に高額。"),
]

data['cards'].extend(new_cards)

json.dump(data, open('data/pokeca_data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f"完了: boxes={len(data['boxes'])}, cards={len(data['cards'])}")
print(f"追加カード: {len(new_cards)}枚")
