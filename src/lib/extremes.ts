import type { PriceExtremes, PriceRecord } from '@/types/pokeca'

// 価格履歴は90日ローリングで古い日が消えるため、全期間の高値・安値は
// data/price-extremes.json に別途積み上げる。ここはその判定ロジック（スクレイパーと
// 再構築スクリプトの両方から使う。実装が2つに割れると極値の基準がズレるため必ず共通化する）。

// バッジを出すのに最低限必要なレコード数。新弾は初日に必ず「最高かつ最安」になるので、
// これ未満のカードでは「更新」表示をしない。
export const MIN_RECORDS_FOR_BADGE = 7

// 少数の取引で付いた値は実勢から外れやすいので極値に採らない（sample_count はスニダン採用時のみ入る）
const MIN_SAMPLE_COUNT = 4
// 前日比がこれを超える動きは相場変動でなく算出方式やノイズ由来の疑いが強い
// （2026-06 の算出方式切替で avg だけが2倍に跳ねた事故と同じ基準）
const MAX_DAY_CHANGE = 0.2

export function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

/** 極値の候補にしてよいレコードか。prev は1つ前（日付が近い方）のレコード */
export function isReliableRecord(r: PriceRecord, prev?: PriceRecord | null): boolean {
  const v = midOf(r)
  if (!v || v <= 0) return false
  if (r.sample_count != null && r.sample_count < MIN_SAMPLE_COUNT) return false
  if (prev) {
    const pv = midOf(prev)
    if (pv > 0 && Math.abs(v / pv - 1) > MAX_DAY_CHANGE) return false
  }
  return true
}

function pointOf(r: PriceRecord) {
  return {
    value: Math.round(midOf(r)),
    date: r.date,
    ...(r.source ? { source: r.source } : {}),
    ...(r.sample_count != null ? { sample_count: r.sample_count } : {}),
  }
}

/**
 * 1件のレコードで極値を更新する（スクレイパー用）。
 * 同じ日を取り直した場合は records を二重に増やさない。
 */
export function updateExtremes(
  cur: PriceExtremes | null,
  rec: PriceRecord,
  prev?: PriceRecord | null
): PriceExtremes | null {
  if (!isReliableRecord(rec, prev)) return cur

  const p = pointOf(rec)
  if (!cur) {
    return { high: p, low: p, since: rec.date, records: 1, updated_at: rec.date }
  }

  const sameDay = cur.updated_at === rec.date
  return {
    high: p.value > cur.high.value ? p : cur.high,
    low: p.value < cur.low.value ? p : cur.low,
    since: rec.date < cur.since ? rec.date : cur.since,
    records: sameDay ? cur.records : cur.records + 1,
    updated_at: rec.date,
  }
}

/** 履歴全体から作り直す（初期投入・リセット用）。history は新しい順 */
export function computeExtremes(history: PriceRecord[]): PriceExtremes | null {
  const asc = [...history].sort((a, b) => a.date.localeCompare(b.date))
  let out: PriceExtremes | null = null
  for (let i = 0; i < asc.length; i++) {
    out = updateExtremes(out, asc[i], i > 0 ? asc[i - 1] : null)
  }
  return out
}

/** その日に高値／安値を更新したか（バッジ表示用）。データが浅いうちは出さない */
export function extremeHitToday(
  ex: PriceExtremes | null,
  latestDate: string | undefined
): 'high' | 'low' | null {
  if (!ex || !latestDate) return null
  if (ex.records < MIN_RECORDS_FOR_BADGE) return null
  if (ex.high.date === latestDate && ex.high.value !== ex.low.value) return 'high'
  if (ex.low.date === latestDate && ex.high.value !== ex.low.value) return 'low'
  return null
}
