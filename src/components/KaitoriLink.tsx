// A8.net ふるいち トレカ買取（バナー素材 120x60）。
// 既存の購入導線（メルカリ/楽天/駿河屋＝「買う」）に対して「売る」側の受け皿。
// ステマ規制対応で「PR」表記を必ず併記する（OripaBanner と同じ扱い）。
//
// ⚠ 素材IDはバナーとテキストで別物。A8の計測は素材ごとなので、素材を差し替えたら
//    リンクの a8mat とインプレッション計測gifの a8mat を**必ず同じ値に揃える**こと
//    （2026-08-14 にテキスト素材 BX3J6 からバナー素材 BXIYP へ変更）。
const A8_FURUICHI_MAT = '4B9XT8+CPUCZ6+5W1M+BXIYP'
const A8_FURUICHI_IMG =
  'https://www21.a8.net/svt/bgt?aid=260804204769&wid=001&eno=01&mid=s00000027481002004000&mc=1'

export default function KaitoriLink({ marginY = 18 }: { marginY?: number }) {
  return (
    <div
      style={{
        margin: `${marginY}px 0`,
        padding: '10px 14px',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--r-md)',
        background: 'var(--bg2)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          color: 'var(--ink-faint)',
          fontFamily: 'var(--mono)',
          letterSpacing: '0.1em',
        }}
      >
        PR
      </span>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-dim)' }}>
        手元のカードを売るなら
      </span>
      <a
        href={`https://px.a8.net/svt/ejp?a8mat=${A8_FURUICHI_MAT}`}
        target="_blank"
        rel="nofollow noopener noreferrer"
        style={{
          display: 'inline-flex',
          borderBottom: 'none', // グローバルの a の下線を打ち消す
          lineHeight: 0,        // インライン画像の下に隙間を作らない
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={A8_FURUICHI_IMG}
          width={120}
          height={60}
          alt="ふるいち トレカ買取"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ display: 'block', border: 0, borderRadius: '4px' }}
        />
      </a>
      {/* インプレッション計測タグ。リンクと同じ素材IDでなければ計測がずれる */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www16.a8.net/0.gif?a8mat=${A8_FURUICHI_MAT}`}
        width={1}
        height={1}
        alt=""
        style={{ position: 'absolute', width: 1, height: 1, border: 0 }}
      />
    </div>
  )
}
