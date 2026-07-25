import Image from 'next/image';
import Link from 'next/link';
import type { Series } from '@/data/series';

/** Filled star, used for the rating line. */
function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l2.94 5.955 6.571.955-4.755 4.635 1.123 6.545L12 17l-5.878 3.09 1.123-6.545L2.49 8.91l6.572-.955z" />
    </svg>
  );
}

/**
 * The red "170M+ PLAYS" flag that sits over the top-right of the cover art.
 * "PLAYS" runs vertically in the reference design.
 */
function PlaysBadge({ badge }: { badge: string }) {
  return (
    <div className="absolute top-0.5 right-0.5 z-10 flex h-5 gap-0.5">
      <div className="flex items-stretch bg-fm-red text-white uppercase">
        <p className="flex items-center px-1 text-[11px] leading-none">{badge}</p>
        <div className="flex w-2 items-center justify-center">
          <span className="rotate-90 text-[6px] leading-none whitespace-nowrap">
            Plays
          </span>
        </div>
      </div>
      <svg viewBox="0 0 9 16" fill="none" className="h-5 w-auto" aria-hidden>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1 14.2222C4.43644 14.2222 7.22222 11.4364 7.22222 8C7.22222 4.56356 4.43644 1.77778 1 1.77778C-2.43644 1.77778 -5.22222 4.56356 -5.22222 8C-5.22222 11.4364 -2.43644 14.2222 1 14.2222ZM1 16C5.41828 16 9 12.4183 9 8C9 3.58172 5.41828 0 1 0C-3.41828 0 -7 3.58172 -7 8C-7 12.4183 -3.41828 16 1 16Z"
          fill="#d1111e"
        />
        <path d="M0 4V12L6 8L0 4Z" fill="#d1111e" />
      </svg>
    </div>
  );
}

export default function SeriesCard({
  series,
  width = 170,
  priority = false,
}: {
  series: Series;
  width?: number;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/show/${series.id}`}
      title={series.title}
      className="group relative block shrink-0 origin-left rounded-sm transition-transform duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:ring-fm-accent focus-visible:outline-none"
      style={{ width }}
    >
      <div className="relative">
        <Image
          src={series.image}
          alt={series.title}
          width={width}
          height={width}
          preload={priority}
          className="rounded-sm"
          style={{ width, height: width }}
        />
        {series.badge && <PlaysBadge badge={series.badge} />}
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm text-fm-primary">
            {series.plays}{' '}
            <span className="text-fm-tertiary uppercase">Plays</span>
          </span>
          {series.rating && (
            <span className="flex shrink-0 items-center gap-1">
              <StarIcon className="size-3 text-fm-tertiary" />
              <span className="text-sm text-fm-primary">{series.rating}</span>
            </span>
          )}
        </div>
        <h3 className="truncate text-sm text-fm-tertiary">{series.title}</h3>
      </div>
    </Link>
  );
}
