/**
 * "Download the app" banner that sits between the last card row and the footer.
 * Store badges and the QR block are drawn inline rather than sourced, so the
 * banner carries no third-party artwork.
 */

function AppStoreBadge({ store }: { store: 'ios' | 'android' }) {
  const label = store === 'ios' ? 'App Store' : 'Google Play';
  return (
    <a
      href="#"
      className="flex items-center gap-2.5 rounded-lg border-[0.8px] border-fm-border bg-black px-4 py-2.5 transition-colors hover:border-fm-border-bright"
    >
      {store === 'ios' ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-6 text-white" aria-hidden>
          <path d="M16.4 12.8c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.7-1.5 0-2.8.9-3.6 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.7.7 1.1 0 1.9-1.1 2.6-2.1.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.1-.8-2.1-3.5zM14.3 5.9c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
          <path d="M3.6 2.4c-.3.3-.5.8-.5 1.4v16.4c0 .6.2 1.1.5 1.4l9.1-9.6-9.1-9.6z" fill="#34a853" />
          <path d="M16.3 15.1l-3.6-3.1 3.6-3.1 4.2 2.3c.8.5.8 1.2 0 1.7l-4.2 2.2z" fill="#fbbc04" />
          <path d="M3.6 2.4l9.1 9.6 3.6-3.1L5.6 2.6c-.7-.4-1.5-.5-2-.2z" fill="#ea4335" />
          <path d="M3.6 21.6l9.1-9.6 3.6 3.1L5.6 21.4c-.7.4-1.5.5-2 .2z" fill="#4285f4" />
        </svg>
      )}
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] tracking-wide text-fm-tertiary uppercase">
          Get it on
        </span>
        <span className="text-sm font-semibold text-white">{label}</span>
      </span>
    </a>
  );
}

/** Decorative QR-style block — a deterministic pattern, not a real code. */
function QrBlock() {
  const cells: boolean[] = [];
  // Simple deterministic hash pattern so it renders identically every time.
  for (let i = 0; i < 21 * 21; i++) {
    const x = i % 21;
    const y = Math.floor(i / 21);
    const finder =
      (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    const inner =
      finder &&
      !((x === 1 || x === 5 || y === 1 || y === 5) && !(x === 0 || x === 6 || y === 0 || y === 6));
    cells.push(finder ? !inner || (x + y) % 2 === 0 : ((x * 7 + y * 13 + x * y) % 5) % 2 === 0);
  }
  return (
    <div className="rounded-lg bg-white p-3">
      <div
        className="grid size-[104px] gap-0"
        style={{ gridTemplateColumns: 'repeat(21, minmax(0, 1fr))' }}
        aria-hidden
      >
        {cells.map((on, i) => (
          <span key={i} className={on ? 'bg-black' : 'bg-white'} />
        ))}
      </div>
    </div>
  );
}

export default function AppBanner() {
  return (
    <section className="mt-14 mr-8 overflow-hidden rounded-2xl bg-gradient-to-br from-fm-surface-2 via-fm-surface to-fm-bg">
      <div className="flex flex-wrap items-center justify-between gap-8 px-10 py-10">
        <div className="max-w-sm">
          <h2 className="text-3xl leading-tight font-bold text-white">
            Superhit series.
            <br />
            For a superstar like you.
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <AppStoreBadge store="ios" />
            <AppStoreBadge store="android" />
          </div>
        </div>

        {/* Phone mock showing a mini player */}
        <div className="relative hidden h-[210px] w-[300px] shrink-0 lg:block">
          <div className="absolute top-0 left-1/2 h-[210px] w-[112px] -translate-x-1/2 rounded-[18px] border-4 border-fm-elevated bg-fm-bg p-1.5">
            <div className="h-full w-full overflow-hidden rounded-[12px] bg-gradient-to-b from-fm-accent/40 to-fm-bg">
              <div className="mt-8 flex flex-col items-center gap-2 px-2">
                <div className="size-16 rounded bg-white/15" />
                <div className="h-1.5 w-14 rounded-full bg-white/25" />
                <div className="h-1.5 w-10 rounded-full bg-white/15" />
                <div className="mt-2 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-white/40" />
                  <span className="flex size-6 items-center justify-center rounded-full bg-white text-black">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <span className="size-1.5 rounded-full bg-white/40" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          <QrBlock />
          <p className="max-w-[120px] text-center text-[11px] leading-snug text-fm-tertiary">
            Scan to download the EchoFM app
          </p>
        </div>
      </div>
    </section>
  );
}
