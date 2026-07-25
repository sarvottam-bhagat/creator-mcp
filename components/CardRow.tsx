'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SeriesCard from './SeriesCard';
import type { Row, Series } from '@/data/series';

const CARD_W = 170;
const GAP = 12;

/** Rank numerals 1–10 for the "Popular on EchoFM" row. */
function RankNumeral({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="rank-numeral pointer-events-none shrink-0 self-end pb-6 text-[128px] leading-[0.72] font-extrabold tabular-nums select-none"
      style={{ marginRight: n === 10 ? -16 : -22 }}
    >
      {n}
    </span>
  );
}

function Arrow({
  dir,
  onClick,
  disabled,
}: {
  dir: 'left' | 'right';
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      className="flex size-8 items-center justify-center rounded-full text-fm-secondary transition-colors hover:bg-white/10 hover:text-fm-primary disabled:pointer-events-none disabled:opacity-25"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  );
}

export default function CardRow({
  title,
  variant,
  items,
  priority = false,
}: {
  title: string;
  variant: Row['variant'];
  items: Series[];
  priority?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    // Advance by whole cards so the row never lands mid-cover.
    const step = CARD_W + GAP;
    const cards = Math.max(1, Math.floor(el.clientWidth / step) - 1);
    el.scrollBy({ left: dir * cards * step, behavior: 'smooth' });
  };

  const ranked = variant === 'ranked';

  return (
    <section className="mt-9">
      <div className="mb-3 flex items-center justify-between gap-4 pr-8">
        <h2 className="text-xl text-fm-primary">{title}</h2>
        <div className="flex items-center gap-1">
          <Arrow dir="left" onClick={() => scrollBy(-1)} disabled={atStart} />
          <Arrow dir="right" onClick={() => scrollBy(1)} disabled={atEnd} />
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={sync}
        className="no-scrollbar flex items-start gap-3 overflow-x-auto scroll-smooth pr-8 pb-1"
      >
        {items.map((s, i) => (
          <div key={s.id} className={ranked ? 'flex items-stretch' : undefined}>
            {ranked && <RankNumeral n={i + 1} />}
            <SeriesCard series={s} priority={priority && i < 7} />
          </div>
        ))}
      </div>
    </section>
  );
}
