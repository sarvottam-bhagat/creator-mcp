'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Series } from '@/data/series';

const ROTATE_MS = 7000;

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l2.94 5.955 6.571.955-4.755 4.635 1.123 6.545L12 17l-5.878 3.09 1.123-6.545L2.49 8.91l6.572-.955z" />
    </svg>
  );
}

export default function Hero({ slides }: { slides: Series[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = slides[index];

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => go(1), ROTATE_MS);
    return () => clearInterval(t);
  }, [go, paused]);

  if (!active) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="EchoFM Spotlight"
      className="relative isolate overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Backdrop: the wide art blown out behind everything. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {slides.map((s, i) => (
          <Image
            key={s.id}
            src={s.banner ?? s.image}
            alt=""
            fill
            preload={i === 0}
            className={`object-cover object-center transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-fm-bg/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-fm-bg via-fm-bg/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-fm-bg via-transparent to-fm-bg/60" />
      </div>

      <div className="flex min-h-[520px] items-center gap-10 px-8 py-10">
        {/* Text column */}
        <div className="w-[42%] max-w-[520px] shrink-0">
          <h1 className="text-5xl leading-[1.05] font-bold tracking-tight text-white uppercase">
            {active.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="font-semibold tracking-wide text-amber-400 uppercase">
              {active.plays} plays
            </span>
            <span className="text-fm-tertiary">·</span>
            <span className="flex items-center gap-1.5 rounded-full border-[0.8px] border-fm-border px-2.5 py-1">
              <StarIcon className="size-3.5 text-white" />
              <span className="font-semibold text-white">{active.rating}</span>
              <span className="text-fm-tertiary">|</span>
              <span className="text-fm-secondary">{active.episodes} eps</span>
            </span>
            <span className="text-fm-tertiary">·</span>
            <span className="text-fm-secondary uppercase">{active.genre}</span>
            <span className="text-fm-tertiary">·</span>
            <span className="rounded-sm border-[0.8px] border-fm-border px-1.5 py-0.5 text-xs font-semibold text-fm-secondary">
              {active.ageRating}
            </span>
          </div>

          {active.tagline && (
            <p className="mt-5 max-w-md text-base text-fm-secondary">
              {active.tagline}
            </p>
          )}

          <div className="mt-8 flex items-center gap-3">
            <Link
              href={`/show/${active.id}`}
              className="rounded-full border-[0.8px] border-fm-border-strong bg-fm-elevated px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-black"
            >
              Play Now
            </Link>
            <Link
              href={`/show/${active.id}`}
              className="rounded-full border-[0.8px] border-fm-border-bright px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              More Info
            </Link>
          </div>

          {active.author && (
            <p className="mt-6 text-sm text-fm-tertiary">by {active.author}</p>
          )}
        </div>

        {/* Art column */}
        <div className="relative min-w-0 flex-1">
          <div className="relative ml-auto aspect-[16/9] w-full max-w-[1040px] overflow-hidden rounded-lg">
            {slides.map((s, i) => (
              <Image
                key={s.id}
                src={s.banner ?? s.image}
                alt={s.title}
                fill
                preload={i === 0}
                sizes="(max-width: 1280px) 60vw, 1040px"
                className={`object-cover transition-opacity duration-700 ${
                  i === index ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-fm-bg/70 via-transparent to-transparent"
            />
          </div>

          {/* Thumbnail switcher */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous title"
              className="flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/80"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-4"
                aria-hidden
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${s.title}`}
                aria-current={i === index}
                className={`relative h-11 w-[72px] shrink-0 overflow-hidden rounded transition-all ${
                  i === index
                    ? 'ring-2 ring-fm-accent'
                    : 'opacity-55 hover:opacity-90'
                }`}
              >
                <Image src={s.image} alt="" fill sizes="72px" className="object-cover" />
              </button>
            ))}

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next title"
              className="flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/80"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-4"
                aria-hidden
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
