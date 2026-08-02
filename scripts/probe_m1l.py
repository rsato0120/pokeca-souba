# -*- coding: utf-8 -*-
"""M1L(メガブレイブ)のapparel IDを偵察スキャン。範囲を引数で渡す。
使い方: python probe_m1l.py 657350 657380   (lo hi)
        python probe_m1l.py 655000 666000 50 (lo hi step=粗探索)
ヒットしたID/カード名/番号だけ表示。"""
import re, subprocess, time, sys
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

def get_title(aid):
    for _ in range(6):
        try:
            r = subprocess.run(['curl', '-s', '--max-time', '12', '-A', UA,
                                f'https://snkrdunk.com/apparels/{aid}'],
                               capture_output=True, timeout=16)
            out = r.stdout.decode('utf-8', 'replace')
            m = re.search(r'<title>([^<]*)</title>', out)
            if m and m.group(1).strip():
                return m.group(1).strip()
            if len(out) > 2000:
                return ''  # 存在するがM1Lでない等
        except Exception:
            pass
        time.sleep(0.6)
    return None  # 接続失敗

def main():
    lo, hi = int(sys.argv[1]), int(sys.argv[2])
    step = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    hits = 0
    for aid in range(lo, hi + 1, step):
        t = get_title(aid)
        if t is None:
            print(f"{aid}: (接続失敗)", flush=True)
            continue
        if 'M1L' in t:
            m = re.search(r'^(.+?)\s+(SAR|MUR|MA|AR|SR|UR|HR|RRR|RR|R)\s+\[M1L\s+(\d+)/', t)
            label = f"{m.group(1)} {m.group(2)} {m.group(3)}" if m else t[:50]
            print(f"{aid}: ★M1L {label}", flush=True)
            hits += 1
        # else: 静かにスキップ
    print(f"--- 完了 {lo}-{hi} step{step}: M1Lヒット {hits}件 ---", flush=True)

if __name__ == '__main__':
    main()
