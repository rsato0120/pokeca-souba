import json

with open('C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json', encoding='utf-8') as f:
    data = json.load(f)

IMG = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/M2a/M2a_{n}_R_JP_LG.png"
BOX = "mega_dream_ex"
TOTAL = "193"

def img(n): return IMG.format(n=str(n).zfill(3))
def no(n): return f"{n}/{TOTAL}"

def pokemon(card_id, card_no_num, rarity, card_name, ptype, stage, hp, note_text,
            competitive="low", char_pop="mid", reg="I", rot="far", illustrator="unknown",
            ill_pop="unknown", artwork="original", reprint="none", scarcity="normal",
            is_reprint=False, ev_player="", ev_collector="", ev_source=""):
    return {
        "id": card_id,
        "card_no": no(card_no_num),
        "rarity": rarity,
        "card_name": card_name,
        "box_id": BOX,
        "is_reprint": is_reprint,
        "image_url": img(card_no_num),
        "card_spec": {"type": ptype, "stage": stage, "hp": hp, "note": note_text},
        "materials": {
            "player": {"regulation_mark": reg, "rotation": rot, "competitive_usage": competitive},
            "collector": {"illustrator": illustrator, "illustrator_popularity": ill_pop, "artwork_type": artwork, "rarity": rarity},
            "common": {"reprint_status": reprint, "scarcity": scarcity, "character_popularity": char_pop}
        },
        "evidence_notes": {"player": ev_player, "collector": ev_collector, "source": ev_source},
        "note": ""
    }

def trainer(card_id, card_no_num, rarity, card_name, trainer_type, note_text,
            competitive="mid", reg="I", rot="far", illustrator="unknown", ill_pop="unknown",
            artwork="original", reprint="none", scarcity="normal", is_reprint=False,
            ev_player="", ev_collector="", ev_source=""):
    return {
        "id": card_id,
        "card_no": no(card_no_num),
        "rarity": rarity,
        "card_name": card_name,
        "box_id": BOX,
        "is_reprint": is_reprint,
        "image_url": img(card_no_num),
        "card_spec": {"type": trainer_type, "stage": "トレーナーズ", "hp": 0, "note": note_text},
        "materials": {
            "player": {"regulation_mark": reg, "rotation": rot, "competitive_usage": competitive},
            "collector": {"illustrator": illustrator, "illustrator_popularity": ill_pop, "artwork_type": artwork, "rarity": rarity},
            "common": {"reprint_status": reprint, "scarcity": scarcity, "character_popularity": "unknown"}
        },
        "evidence_notes": {"player": ev_player, "collector": ev_collector, "source": ev_source},
        "note": ""
    }

new_cards = [
    # AR (194-213)
    pokemon("mega-dream-ex-agehanto-ar", 194, "AR", "アゲハント", "草", "進化", 80, "蝶ポケモンのAR。コレクター向け。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-dokukeiru-ar", 195, "AR", "ドクケイル", "草", "進化", 70, "毒タイプの進化系。コレクター向け。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-subomii-ar", 196, "AR", "スボミー", "草", "たね", 40, "ロゼリアの前進化。かわいい系AR。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-hibiki-no-magukarugo-ar", 197, "AR", "ヒビキのマグカルゴ", "炎", "進化", 110, "ヒビキのマグカルゴ。キャラAR。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-donmeru-ar", 198, "AR", "ドンメル", "炎", "たね", 70, "バクーダの前進化。のどかな描き下ろし。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-kodakku-ar", 199, "AR", "コダック", "水", "たね", 60, "人気キャラ・コダックのAR。", competitive="none", char_pop="high"),
    pokemon("mega-dream-ex-yukiwarashi-ar", 200, "AR", "ユキワラシ", "水", "たね", 50, "雪をテーマにした冬の描き下ろし。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-erezaado-ar", 201, "AR", "エレザード", "雷", "進化", 100, "電気/ノーマルタイプの爬虫類ポケモン。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-muuma-ar", 202, "AR", "ムウマ", "超", "たね", 60, "ミスドレバスの前進化。コレクター人気あり。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-togekissu-ar", 203, "AR", "トゲキッス", "無", "進化", 150, "愛の妖精ポケモン。人気が高い。", competitive="none", char_pop="high"),
    pokemon("mega-dream-ex-hoppu-no-orotto-ar", 204, "AR", "ホップのオーロット", "超", "進化", 130, "ホップとオーロットのキャラAR。剣盾世代人気。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-roketto-dan-no-mimikkyu-ar", 205, "AR", "ロケット団のミミッキュ", "超", "たね", 70, "ロケット団コスのミミッキュ。コレクター人気高い。", competitive="none", char_pop="high"),
    pokemon("mega-dream-ex-roketto-dan-no-dagutorio-ar", 206, "AR", "ロケット団のダグトリオ", "闘", "進化", 90, "ロケット団コスのダグトリオ。レトロなコレクターAR。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-chaaremu-ar", 207, "AR", "チャーレム", "闘", "進化", 80, "武道的な描き下ろし。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-shirona-no-mikaruge-ar", 208, "AR", "シロナのミカルゲ", "超", "たね", 30, "シロナとミカルゲのAR。シロナ人気でコレクター需要あり。", competitive="none", char_pop="high"),
    pokemon("mega-dream-ex-gararu-tachifusaguma-ar", 209, "AR", "ガラルタチフサグマ", "悪", "進化", 140, "ガラル地方限定進化系。ガラルサポーターに人気。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-n-no-zekuromu-ar", 210, "AR", "Nのゼクロム", "雷", "たね", 130, "N×ゼクロムのAR。BW世代人気で高需要。", competitive="none", char_pop="high"),
    pokemon("mega-dream-ex-dorameshiya-ar", 211, "AR", "ドラメシヤ", "超", "たね", 40, "ドラパルトの前進化。かわいい系AR。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-doronchi-ar", 212, "AR", "ドロンチ", "超", "進化", 80, "ドラパルトの中間進化。コレクター向け。", competitive="none", char_pop="mid"),
    pokemon("mega-dream-ex-supin-rotomu-ar", 213, "AR", "スピンロトム", "雷", "たね", 70, "ロトムのスピン変化形。ロトムフォルムコレクター向け。", competitive="none", char_pop="mid"),

    # SR (214-222)
    trainer("mega-dream-ex-n-no-pointo-appu-sr", 214, "SR", "Nのポイントアップ", "グッズ", "N（BW）のグッズSR。コレクター向け。", competitive="low"),
    trainer("mega-dream-ex-garasu-no-rappa-sr", 215, "SR", "ガラスのラッパ", "グッズ", "カラフルなグッズカード。特定デッキで採用される。", competitive="mid"),
    trainer("mega-dream-ex-haipaa-booru-sr", 216, "SR", "ハイパーボール", "グッズ", "汎用サーチグッズのSR仕様。競技採用率高い定番カード。", competitive="high", is_reprint=True, reprint="reprinted"),
    trainer("mega-dream-ex-roketto-dan-no-reshiibaa-sr", 217, "SR", "ロケット団のレシーバー", "グッズ", "ロケット団テーマデッキサポート。ロケット団デッキで採用。", competitive="mid"),
    trainer("mega-dream-ex-kauntaa-gein-sr", 218, "SR", "カウンターゲイン", "グッズ", "相手リード時の追加エネルギー効果。カウンター系デッキで使用。", competitive="mid"),
    trainer("mega-dream-ex-kanari-sr", 219, "SR", "カナリィ", "サポート", "強力なドローサポート。競技採用率高い。", competitive="high"),
    trainer("mega-dream-ex-karate-ou-no-keiko-sr", 220, "SR", "からておうの稽古", "サポート", "格闘道場系サポート。闘デッキで採用。", competitive="mid"),
    trainer("mega-dream-ex-baabena-to-hereena-sr", 221, "SR", "バーベナとヘレナ", "サポート", "キャラクターサポート。特定戦略で使用。", competitive="mid"),
    trainer("mega-dream-ex-jamingu-tawaa-sr", 222, "SR", "ジャミングタワー", "スタジアム", "相手のサポートを制限するスタジアム。メタゲームで活躍。", competitive="mid"),

    # MA (223-232)
    pokemon("mega-dream-ex-mega-rizaadon-x-ex-ma", 223, "MA", "メガリザードンXex", "炎", "メガシンカex", 230, "XY人気No.1のメガシンカ。青い炎のリザードンX。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-yukimenoko-ex-ma", 224, "MA", "メガユキメノコex", "水", "メガシンカex", 210, "氷雪美人ポケモンのメガシンカ。コレクター需要高い。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-mega-shibirudon-ex-ma", 225, "MA", "メガシビルドンex", "雷", "メガシンカex", 220, "電気ウナギのメガシンカ。レトロ人気あり。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-mega-saanaito-ex-ma", 226, "MA", "メガサーナイトex", "超", "メガシンカex", 210, "妖精×超タイプのメガシンカ。人気高い。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-dianshii-ex-ma", 227, "MA", "メガディアンシーex", "超", "メガシンカex", 210, "幻のポケモンのメガシンカ。コレクター需要高い。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-rukario-ex-ma", 228, "MA", "メガルカリオex", "闘", "メガシンカex", 210, "XY時代の看板ポケモンのメガシンカ。根強い人気。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-ruchaburu-ex-ma", 229, "MA", "メガルチャブルex", "水", "メガシンカex", 210, "ルチャドール系ポケモンのメガシンカ。コアなファン人気。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-mega-gengaa-ex-ma", 230, "MA", "メガゲンガーex", "超", "メガシンカex", 220, "初代ゴーストポケモンのメガシンカ。根強い人気。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-zuruuzukin-ex-ma", 231, "MA", "メガズルズキンex", "悪", "メガシンカex", 210, "不良スタイルのポケモンのメガシンカ。コアなファン人気。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-mega-kairyuu-ex-ma", 232, "MA", "メガカイリューex", "無", "メガシンカex", 230, "カイリューのメガシンカ。ドラゴン代表でMURと並ぶ人気。", competitive="low", char_pop="high"),

    # SAR (233-249)
    pokemon("mega-dream-ex-mega-yukimenoko-ex-sar", 233, "SAR", "メガユキメノコex", "水", "メガシンカex", 210, "ユキメノコSARの美麗アート版。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-pikachu-ex-sar", 234, "SAR", "ピカチュウex", "雷", "たねex", 120, "国民的ポケモンのexSAR。常に高需要。", competitive="mid", char_pop="high"),
    pokemon("mega-dream-ex-mega-shibirudon-ex-sar", 235, "SAR", "メガシビルドンex", "雷", "メガシンカex", 220, "メガシビルドンの美麗SAR版。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-nanjamo-no-harabarii-ex-sar", 236, "SAR", "ナンジャモのハラバリーex", "雷", "たねex", 220, "人気キャラ・ナンジャモとハラバリーの組み合わせSAR。", competitive="mid", char_pop="high"),
    pokemon("mega-dream-ex-roketto-dan-no-myuutsuu-ex-sar", 237, "SAR", "ロケット団のミュウツーex", "超", "たねex", 150, "ロケット団×ミュウツーの特別コラボSAR。コレクター最高峰。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-dianshii-ex-sar", 238, "SAR", "メガディアンシーex", "超", "メガシンカex", 210, "メガディアンシーの美麗SAR版。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-ruchaburu-ex-sar", 239, "SAR", "メガルチャブルex", "水", "メガシンカex", 210, "メガルチャブルの美麗SAR版。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-mega-gengaa-ex-sar", 240, "SAR", "メガゲンガーex", "超", "メガシンカex", 220, "メガゲンガーの美麗SAR版。ゴースト系SAR需要高い。", competitive="low", char_pop="high"),
    pokemon("mega-dream-ex-mega-zuruuzukin-ex-sar", 241, "SAR", "メガズルズキンex", "悪", "メガシンカex", 210, "メガズルズキンの美麗SAR版。", competitive="low", char_pop="mid"),
    pokemon("mega-dream-ex-n-no-zoroaaku-ex-sar", 242, "SAR", "Nのゾロアークex", "悪", "進化ex", 130, "N×ゾロアークの強力キャラSAR。BW世代人気で高需要。", competitive="mid", char_pop="high"),
    pokemon("mega-dream-ex-marii-no-ooronge-ex-sar", 243, "SAR", "マリィのオーロンゲex", "悪", "進化ex", 160, "人気キャラ・マリィとオーロンゲのSAR。マリィ人気で高需要。", competitive="mid", char_pop="high"),
    pokemon("mega-dream-ex-kichikigisu-ex-sar", 244, "SAR", "キチキギスex", "無", "たねex", 160, "電撃戦で活躍するキチキギスexのSAR。競技採用率あり。", competitive="mid", char_pop="mid"),
    pokemon("mega-dream-ex-daigo-no-metagurosu-ex-sar", 245, "SAR", "ダイゴのメタグロスex", "鋼", "進化ex", 260, "ダイゴ×メタグロスの王道キャラSAR。ダイゴ人気で需要高い。", competitive="mid", char_pop="high"),
    pokemon("mega-dream-ex-mega-kairyuu-ex-sar", 246, "SAR", "メガカイリューex", "無", "メガシンカex", 230, "このセットの看板MURに次ぐSAR。需要安定。", competitive="low", char_pop="high"),
    trainer("mega-dream-ex-airisu-no-toushi-sar", 247, "SAR", "アイリスの闘志", "サポート", "アイリス（BW）のSARサポート。アイリス人気でコレクター需要。", competitive="mid"),
    trainer("mega-dream-ex-kanari-sar", 248, "SAR", "カナリィ", "サポート", "カナリィSARは今弾の最注目カードの一つ。美麗アート。", competitive="high"),
    trainer("mega-dream-ex-saafaa-sar", 249, "SAR", "サーファー", "サポート", "サーファーSAR。夏×海テーマの爽やかなアート。", competitive="low"),

    # MUR (250)
    pokemon("mega-dream-ex-mega-kairyuu-ex-mur", 250, "MUR", "メガカイリューex", "無", "メガシンカex", 230, "このセット最高レアリティのMUR。カイリューのメガシンカで最高峰。", competitive="low", char_pop="high"),
]

new_box = {
    "box_id": "mega_dream_ex",
    "box_name": "MEGAドリームex",
    "code": "M2a",
    "release_ym": "2025-11",
    "certainty": "released",
    "pack_price_yen": 550,
    "packs_per_box": 10,
    "pack_image_url": "https://www.pokemon-card.com/ex/m2a/assets/images/hero-pkg.png",
    "note": "2025-11-28発売。ハイクラスパック。メガシンカexを大量収録。新レアリティMA（メガアタックレア）初登場。目玉はメガカイリューexMUR・カナリィSAR。"
}

storm_idx = next(i for i, b in enumerate(data['boxes']) if b['box_id'] == 'storm_emeralda')
data['boxes'].insert(storm_idx, new_box)
data['cards'].extend(new_cards)

with open('C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"追加完了: boxes={len(data['boxes'])}, cards={len(data['cards'])}")
print(f"メガドリーム追加カード数: {len(new_cards)}")
