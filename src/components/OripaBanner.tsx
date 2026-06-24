// A8.net オリパ案件バナー（素材ID 004 / 100×60）。
// ステマ規制対応で「PR」表記を必ず併記する。
export default function OripaBanner({ marginY = 18 }: { marginY?: number }) {
  return (
    <div style={{ textAlign: 'center', margin: `${marginY}px 0` }}>
      <div style={{ fontSize: '10px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.1em', marginBottom: '4px' }}>
        PR
      </div>
      <a
        href="https://px.a8.net/svt/ejp?a8mat=4B60CK+2V00FM+5H3K+5Z6WX"
        rel="nofollow noopener noreferrer"
        target="_blank"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={100}
          height={60}
          alt="ハズレなしのオリパガチャ"
          src="https://www23.a8.net/svt/bgt?aid=260620868173&wid=001&eno=01&mid=s00000025544001004000&mc=1"
          style={{ border: 0, display: 'inline-block' }}
        />
      </a>
      {/* インプレッション計測タグ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        width={1}
        height={1}
        src="https://www11.a8.net/0.gif?a8mat=4B60CK+2V00FM+5H3K+5Z6WX"
        alt=""
        style={{ position: 'absolute', width: 1, height: 1, border: 0 }}
      />
    </div>
  )
}
