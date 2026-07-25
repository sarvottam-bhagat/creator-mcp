import TopBar from '@/components/TopBar';

export const metadata = { title: 'Studio — EchoFM' };

/**
 * Placeholder. The creator dashboard (series list, episode table, draft flow)
 * lands here in Phase 1; for now the rail entry needs a destination.
 */
export default function StudioPage() {
  return (
    <>
      <TopBar />
      <main className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-fm-surface-2 text-fm-tertiary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-7"
            aria-hidden
          >
            <path d="M4 20h5l10.5-10.5a2.1 2.1 0 0 0-3-3L6 17v3z" />
            <path d="M14.5 6.5 17.5 9.5" />
          </svg>
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-fm-primary">Studio</h1>
        <p className="mt-2 max-w-md text-sm text-fm-tertiary">
          The creator workspace lives here — series, episodes and drafts.
          Nothing to see yet.
        </p>
      </main>
    </>
  );
}
