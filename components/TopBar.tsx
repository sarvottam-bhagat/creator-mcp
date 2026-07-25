export default function TopBar({ userName = 'Sarvottam' }: { userName?: string }) {
  return (
    <header className="flex items-center gap-8 px-8 pt-6 pb-4">
      <div className="w-40 shrink-0">
        <p className="text-[11px] tracking-[0.12em] text-fm-tertiary uppercase">
          Hello
        </p>
        <p className="truncate text-2xl text-fm-primary">{userName}</p>
      </div>

      {/* GET to /search keeps this a server component; wiring lands with search. */}
      <form
        role="search"
        action="/search"
        className="relative mx-auto w-full max-w-[840px]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-fm-tertiary"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          name="q"
          placeholder="Search for audio series, artists"
          aria-label="Search for audio series, artists"
          className="h-11 w-full rounded-full border-[0.8px] border-fm-border bg-white/[0.06] pr-10 pl-11 text-sm text-white placeholder:text-fm-tertiary focus:border-fm-border-bright focus:outline-none"
        />
      </form>

      <button
        type="button"
        aria-label="Change language"
        className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full border-[0.8px] border-fm-border text-fm-secondary transition-colors hover:border-fm-border-bright hover:text-fm-primary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-5"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
        </svg>
      </button>
    </header>
  );
}
