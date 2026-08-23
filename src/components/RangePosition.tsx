import type { PriceExtremes } from '@/types/pokeca'

// 全期間の高値〜安値（＝値幅）のどこにいるか。株の「52週高値からの下落率」にあたる指標。
//
// 「¥12,000です」と言われても高いのか安いのか分からない。
// そのカード自身の高値・安値のどこに今いるかが分かると、初めて水準の判断ができる。
// この位置はもともと買いシグナルの内部スコア（buy-signals.ts）で使っていたが、
// 数字として画面に出ていなかったのでここで露出させる。
//
// ⚠ 画面の言葉は「レンジ」ではなく **「値幅」** に揃えること。
//   レンジは英語圏の "52-Week Range" の直訳で、日本の証券サイトでは
//   「値幅」「高値圏／安値圏」「高値からの下落率」に分解して書くのが普通。
//   （英語ラベルは HIGH-LOW。RANGE だと日本語側と対応が取れない）

interface Props {
  extremes: PriceExtremes
  /** 現在の代表値 */
  mid: number
}

export default function RangePosition({ extremes, mid }: Props) {
  const high = Number(extremes.high.value)
  const low = Number(extremes.low.value)
  if (!(mid > 0) || !(high > low)) return null

  const pos = Math.min(100, Math.max(0, ((mid - low) / (high - low)) * 100))

  // ⚠ 現在値が記録上の高値・安値の外に出ることがある。極値は信頼できるレコードだけを
  //   採る（sample_count が薄い日・前日比±20%超の日は採らない）ので、
  //   当日の相場がその外側に来た状態が普通に起きる。
  //   符号を固定して「安値から +」と書くと、安値を下回った日に "+-3.0%" になる。
  //   なので符号は値から作る。
  const offHigh = ((high - mid) / high) * 100   // 正 = 高値より下
  const offLow = ((mid - low) / low) * 100      // 正 = 安値より上
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`

  // 位置に応じた読み。上下25%を「圏」と呼ぶ。
  // 高値圏／安値圏は日本株でもそのまま使われている語なので、この2つは触らない。
  const zone =
    pos >= 75 ? { label: '高値圏', color: 'var(--up)' }
      : pos <= 25 ? { label: '安値圏', color: 'var(--down)' }
        : { label: '中位', color: 'var(--flat)' }

  return (
    <div style={{ marginBottom: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-2)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', letterSpacing: 'var(--ls-wide)' }}>
          HIGH-LOW · 値幅の中の位置
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', fontWeight: 700, color: zone.color }}>
          {zone.label}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', color: 'var(--ink-dim)', marginLeft: 'auto' }}>
          高値から {signed(-offHigh)} ／ 安値から {signed(offLow)}
        </span>
      </div>

      {/* 安値〜高値の帯の上に現在地を打つ */}
      <div
        style={{
          position: 'relative',
          height: '8px',
          borderRadius: 'var(--r-pill)',
          background: 'linear-gradient(to right, color-mix(in srgb, var(--down) 22%, transparent), var(--hair), color-mix(in srgb, var(--up) 22%, transparent))',
          border: '1px solid var(--hair)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${pos}%`,
            top: '-3px',
            width: '3px',
            height: '12px',
            borderRadius: '2px',
            background: 'var(--ink)',
            transform: 'translateX(-1.5px)',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--mono)',
          fontSize: '10px',
          color: 'var(--ink-faint)',
          marginTop: '4px',
        }}
      >
        <span>安値 ¥{low.toLocaleString()}</span>
        <span>高値 ¥{high.toLocaleString()}</span>
      </div>
    </div>
  )
}
