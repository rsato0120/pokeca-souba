'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface DailyFlipCard {
  slug: string
  category: string
  name: string
  rarity: string
  boxName: string
  image: string | null
  price: number
  metric: string
  tone: 'up' | 'ai' | 'volume'
  reason: string
}

export default function DailyFlipCards({ cards }: { cards: DailyFlipCard[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const allRevealed = cards.length > 0 && revealed.size === cards.length

  function reveal(index: number) {
    setRevealed(prev => new Set(prev).add(index))
  }

  function revealAll() {
    setRevealed(new Set(cards.map((_, i) => i)))
  }

  function reset() {
    setRevealed(new Set())
  }

  if (cards.length === 0) return null

  return (
    <div className="daily-flip">
      <div className="daily-flip-grid">
        {cards.map((card, index) => {
          const isRevealed = revealed.has(index)
          return (
            <article
              className={`daily-flip-card${isRevealed ? ' is-revealed' : ''}`}
              key={`${card.category}-${card.slug}`}
            >
              <button
                type="button"
                className="daily-flip-turn"
                onClick={() => reveal(index)}
                aria-label={isRevealed ? `${card.name}を表示中` : `${card.category}カードをめくる`}
                aria-pressed={isRevealed}
              >
                <span className="daily-flip-inner">
                <span className="daily-flip-back">
                  <span className="daily-flip-category">{card.category}</span>
                  <span className="daily-flip-mark" aria-hidden>相場</span>
                  <span className="daily-flip-hint">タップしてめくる</span>
                </span>
                <span className="daily-flip-front">
                  <span className="daily-flip-category">{card.category}</span>
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 外部カード画像は既存データURLを使用
                    <img src={card.image} alt="" className="daily-flip-image" />
                  ) : (
                    <span className="daily-flip-image daily-flip-image-ph">{card.rarity}</span>
                  )}
                  <span className="daily-flip-copy">
                    <strong>{card.name}</strong>
                    <small>{card.rarity} · {card.boxName}</small>
                    <span className="daily-flip-numbers">
                      <b>¥{card.price.toLocaleString()}</b>
                      <em className={`tone-${card.tone}`}>{card.metric}</em>
                    </span>
                    <span className="daily-flip-reason">{card.reason}</span>
                  </span>
                </span>
                </span>
              </button>
              {isRevealed && <Link className="daily-flip-detail" href={`/cards/${card.slug}`}>詳細を見る →</Link>}
            </article>
          )
        })}
      </div>
      <div className="daily-flip-actions">
        <span>{revealed.size} / {cards.length}枚</span>
        {allRevealed ? (
          <button type="button" onClick={reset}>もう一度伏せる</button>
        ) : (
          <button type="button" onClick={revealAll}>3枚まとめてめくる</button>
        )}
      </div>
    </div>
  )
}
