// A8.net bee本舗（トレカ通販・買取ショップ）バナー（素材ID 003 / 300×250）。
// ステマ規制対応で「PR」表記を必ず併記する（OripaBanner と同じ扱い）。
//
// 置き場所について: カード詳細ページの購入リンク直下は **すでに OripaBanner が占めている**。
// 300×250 を2枚縦に並べると広告塊になって買い物導線そのものが読み飛ばされるため、
// こちらは BOXページの購入リンク直下に置く。BOXページは「メルカリで探す／楽天市場で探す」
// があるのにバナーが無く、かつ BOX を買うかどうか判断している＝ショップ広告と意図が合う。
export default function BeeHonpoBanner({ marginY = 18 }: { marginY?: number }) {
  return (
    <div style={{ textAlign: 'center', margin: `${marginY}px 0` }}>
      <div style={{ fontSize: '10px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.1em', marginBottom: '4px' }}>
        PR
      </div>
      <a
        href="https://px.a8.net/svt/ejp?a8mat=4BAFPM+34IY42+5NJ8+5YZ75"
        rel="nofollow noopener noreferrer"
        target="_blank"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={300}
          height={250}
          alt="bee本舗（トレーディングカード通販・買取）"
          src="https://www28.a8.net/svt/bgt?aid=260827402189&wid=001&eno=01&mid=s00000026378001003000&mc=1"
          style={{ border: 0, display: 'inline-block', maxWidth: '100%', height: 'auto' }}
        />
      </a>
      {/* インプレッション計測タグ。position:absolute にしないとレイアウトに1px混ざる */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        width={1}
        height={1}
        src="https://www19.a8.net/0.gif?a8mat=4BAFPM+34IY42+5NJ8+5YZ75"
        alt=""
        style={{ position: 'absolute', width: 1, height: 1, border: 0 }}
      />
    </div>
  )
}
