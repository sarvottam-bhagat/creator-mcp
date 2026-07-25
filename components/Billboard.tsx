import Image from 'next/image';
import { seriesFor } from '@/data/series';

/**
 * Desaturated filmstrip that closes the page — a wide band of covers at low
 * contrast, purely decorative.
 */
export default function Billboard({ ids }: { ids: string[] }) {
  const items = seriesFor(ids);

  return (
    <div aria-hidden className="relative -mx-8 mt-4 overflow-hidden">
      <div className="flex gap-2 opacity-25 grayscale">
        {items.map((s) => (
          <Image
            key={s.id}
            src={s.image}
            alt=""
            width={150}
            height={150}
            className="size-[150px] shrink-0 rounded-sm object-cover"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-fm-bg via-fm-bg/40 to-transparent" />
    </div>
  );
}
