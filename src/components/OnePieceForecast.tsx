import type { Forecast } from '@/types/pokeca'

export default function OnePieceForecast({ forecast }: { forecast: Forecast }) {
  const { overall, price_forecast: pf } = forecast
  const ranges = [['1か月後', pf.m1_low, pf.m1_high], ['3か月後', pf.m3_low, pf.m3_high], ['6か月後', pf.m6_low, pf.m6_high], ['6か月後・上振れ', pf.up_low, pf.up_high], ['6か月後・下振れ', pf.down_low, pf.down_high]] as const
  return <section className="home-panel"><h2>AIの相場予想</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
      <strong style={{ color: 'var(--up)' }}>上昇 {overall.up_pct}%</strong><strong>横ばい {overall.flat_pct}%</strong><strong style={{ color: 'var(--down)' }}>下落 {overall.down_pct}%</strong>
    </div><p style={{ lineHeight: 1.9 }}>{overall.reason}</p>
    <div className="op-table-scroll"><table className="op-table"><thead><tr><th>期間・シナリオ</th><th>予想価格帯</th></tr></thead><tbody>{ranges.map(([label, low, high]) => <tr key={label}><td>{label}</td><td>¥{low.toLocaleString()}〜¥{high.toLocaleString()}</td></tr>)}</tbody></table></div>
    <p className="source-note">生成日時：{new Date(forecast.generated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}。実成約の履歴に基づくAIの推測です。確率は統計的な保証ではなく、将来の価格を保証しません。</p>
  </section>
}
