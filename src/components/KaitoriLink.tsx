// A8.net ふるいち トレカ買取（テキスト素材）。
// 既存の購入導線（メルカリ/楽天/駿河屋＝「買う」）に対して「売る」側の受け皿。
// ステマ規制対応で「PR」表記を必ず併記する（OripaBanner と同じ扱い）。
const A8_FURUICHI_MAT = '4B9XT8+CPUCZ6+5W1M+BX3J6'

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
        gap: '10px',
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
          alignItems: 'center',
          gap: '4px',
          padding: '5px 14px',
          borderRadius: '20px',
          border: '1px solid var(--gold)',
          borderBottom: '1px solid var(--gold)', // グローバルの a の下線を打ち消す
          color: 'var(--gold)',
          fontSize: '12px',
          fontFamily: 'var(--mono)',
          letterSpacing: '0.03em',
        }}
      >
        ふるいち トレカ買取 →
      </a>
      {/* インプレッション計測タグ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www18.a8.net/0.gif?a8mat=${A8_FURUICHI_MAT}`}
        width={1}
        height={1}
        alt=""
        style={{ position: 'absolute', width: 1, height: 1, border: 0 }}
      />
    </div>
  )
}
