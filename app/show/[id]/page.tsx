import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { SERIES } from '@/data/series';

export function generateStaticParams() {
  return Object.keys(SERIES).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = SERIES[id];
  return { title: series ? `${series.title} — EchoFM` : 'EchoFM' };
}

/**
 * Minimal detail page. Card links need a destination; the real player and
 * episode list arrive with the listener work in Phase 1.
 */
export default async function ShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = SERIES[id];
  if (!series) notFound();

  return (
    <>
      <TopBar />
      <main className="px-8 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-fm-tertiary transition-colors hover:text-fm-primary"
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
          Back
        </Link>

        <div className="mt-6 flex flex-wrap items-start gap-8">
          <Image
            src={series.image}
            alt={series.title}
            width={260}
            height={260}
            className="rounded-lg"
            priority
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-white">{series.title}</h1>
            {series.author && (
              <p className="mt-1.5 text-sm text-fm-tertiary">by {series.author}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fm-secondary">
              <span>{series.plays} plays</span>
              {series.rating && (
                <>
                  <span className="text-fm-tertiary">·</span>
                  <span>★ {series.rating}</span>
                </>
              )}
              <span className="text-fm-tertiary">·</span>
              <span>{series.episodes} episodes</span>
              <span className="text-fm-tertiary">·</span>
              <span className="uppercase">{series.genre}</span>
              <span className="text-fm-tertiary">·</span>
              <span className="rounded-sm border-[0.8px] border-fm-border px-1.5 py-0.5 text-xs">
                {series.ageRating}
              </span>
            </div>
            <p className="mt-6 max-w-prose text-sm text-fm-tertiary">
              Player and episode list coming soon.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
