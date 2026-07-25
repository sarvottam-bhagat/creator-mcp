import TopBar from '@/components/TopBar';
import Hero from '@/components/Hero';
import CardRow from '@/components/CardRow';
import AppBanner from '@/components/AppBanner';
import Footer from '@/components/Footer';
import Billboard from '@/components/Billboard';
import { HERO_IDS, ROWS, seriesFor } from '@/data/series';

export default function HomePage() {
  const hero = seriesFor(HERO_IDS);
  // Closing filmstrip reuses covers from across the catalog.
  const billboardIds = ROWS.flatMap((r) => r.ids).slice(0, 16);

  return (
    <>
      <TopBar />

      <main className="pl-8">
        {/* Hero bleeds to the left edge of the content column. */}
        <div className="-ml-8">
          <Hero slides={hero} />
        </div>

        <h1 className="sr-only">
          Listen to free audio series and stories on EchoFM
        </h1>

        <div className="border-t border-fm-divider pt-2">
          {ROWS.map((row, i) => (
            <CardRow
              key={row.title}
              title={row.title}
              variant={row.variant}
              items={seriesFor(row.ids)}
              priority={i === 0}
            />
          ))}
        </div>

        <AppBanner />
        <Footer />
        <Billboard ids={billboardIds} />
      </main>
    </>
  );
}
