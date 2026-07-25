/*
  Generates the EchoFM demo catalog (data/series.ts) from the cover art in
  public/assets. Titles come from the filenames so each card's text matches its
  artwork; play counts and ratings are deterministic (seeded PRNG) so they stay
  stable across runs and server/client renders agree.

  Phase 2 replaces this module with a Lakebase query. The exported types are the
  contract the UI depends on.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSET_DIR = path.join(ROOT, 'public', 'assets');

/* ---------------------------------------------------------------- prng ---- */

function makeRng(seed) {
  let h = 2166136261 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/* --------------------------------------------------------------- covers --- */

// UI chrome and store badges that ship in the same folder but aren't series art.
const NOT_SERIES = new Set([
  'Billboard_Strip_Image-0.webp',
  'Billboard_Strip_Image-1.webp',
  'Billboard_Strip_Image-3.webp',
  'Download_on_the_App_Store.webp',
  'Get_it_on_Google_Play.webp',
  'Pocket_FM_App.webp',
  'Cassettes.webp',
  'image_80x100_191.webp',
]);

const covers = fs
  .readdirSync(ASSET_DIR)
  .filter((f) => f.endsWith('.webp') && !NOT_SERIES.has(f))
  .sort();

if (!covers.length) {
  throw new Error(`No cover art found in ${ASSET_DIR}`);
}

/**
 * Turn a filename into a display title:
 *   "The_Return_of_Tiger_ (2).webp"                  -> "The Return of Tiger"
 *   "Beggar_Husband_Author_-_Sanjeev_Kumar_Singh"    -> "Beggar Husband"
 * Returns null when nothing usable is left (e.g. "_ (12).webp").
 */
function titleFromFile(file) {
  let s = file.replace(/\.webp$/i, '');
  s = s.replace(/\s*\(\d+\)$/, ''); // drop " (2)" duplicate marker
  s = s.split(/_?Author_?-/i)[0]; // drop trailing author credit
  s = s.replace(/_/g, ' ');
  s = s.replace(/\s*-\s*$/, '').replace(/[-–—]+$/, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s || /^[\d\W]*$/.test(s)) return null;
  return s;
}

/** Author credit embedded in the filename, when present. */
function authorFromFile(file) {
  const m = file.replace(/\.webp$/i, '').match(/Author_?-_?(.+)$/i);
  if (!m) return null;
  const a = m[1].replace(/\s*\(\d+\)$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return a || null;
}

/* --------------------------------------------------------------- genres --- */

// Keyword routing so each cover lands in a plausible genre row.
const GENRE_RULES = [
  ['Horror', /zombie|khauf|khooni|curse|cursed|saaya|yakshini|vashikaran|pret|ghost|witch|andhkaar|zeher|death|blood|rakt/i],
  ['Thriller', /detective|jasoos|surag|clue|case|files|secret|shatir|chat|mystery|mysterious|pawnshop|vardi|daag|number zero/i],
  ['System', /system|interface|divine system|millionaire system|vampire system/i],
  ['Eastern Fantasy', /dragon|naad|hiss|beast|tamer|sovereign|thunder|nine|jade|primordial/i],
  ['Epic Fantasy', /yoddha|warrior|mahabali|shoorveer|garud|vajra|trishul|kingmaker|gambit|vanshaj|veerpur|immortal|legend|guardian|rakshak|destroyer|brahm/i],
  ['Mythology', /mahagatha|chanakya|kashi|ram |shiva|shivay|shivam|devputra|sarvashaktimaan|mrityunjay|akhand|saat vansh|shraap|ved |astra|kalyug|mahamanav/i],
  ['Sci-Fi', /1971|ambar|astra|dimension|void|shadow of the void|soldier on time|time/i],
  ['Romance', /ishq|pyaar|pyar|prem|mohabbat|dil|shaadi|husband|wife|mate|bride|angel|raabta|tera|tere|truly|madly|deeply|sacred bond|billionaire boyfriend|contract|saudebaazi|shart|majburi|rishta|heartless|accidental|princess|rani|kaisa|nafrat|stranger|ladki|pakhi|agar tum|phir le aaya|bus number/i],
  ['Magical Realism', /chamatkari|ilaaj|doctor|mirror|cassette|download|beta|animal|caretaker|care taker|handbook/i],
  ['Action', /commander|chauhan|fauji|khel|dangerous|badass|banda|tiger|k for king|royal|waris|selfmade|zero to hero|hero no zero|raichand/i],
  ['Drama', /billionaire|ameerzaada|empire|insta|millionaire|fortune|beggar|hukkum|ranchandi|kimat|gunah|impossible|survivor|return|avatar|reborn|rule|shunya|samrat/i],
];

function genreFor(title, rng) {
  for (const [genre, re] of GENRE_RULES) {
    if (re.test(title)) return genre;
  }
  return pick(rng, ['Drama', 'Romance', 'Epic Fantasy', 'Thriller']);
}

/* --------------------------------------------------------------- catalog --- */

const rng = makeRng('echofm-catalog-v2');

function fmtPlays(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function fmtBadge(n) {
  if (n >= 1e9) return `${Math.floor(n / 1e9)}B+`;
  if (n >= 1e6) return `${Math.floor(n / 1e6)}M+`;
  if (n >= 1e3) return `${Math.floor(n / 1e3)}K+`;
  return `${n}`;
}

const slugSeen = new Map();
function slugify(s) {
  const base =
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) ||
    'series';
  const n = (slugSeen.get(base) ?? 0) + 1;
  slugSeen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

const AUTHORS = [
  'A. Raghunath', 'Meher Qureshi', 'D. Solanki', 'Ira Banerjee', 'Kabir Anand',
  'S. Vaidya', 'Nomita Rao', 'P. Deshmukh', 'Yusuf Alam', 'Tara Iyengar',
  'V. Chandrasekhar', 'Rehan Mirza', 'Juhi Sampat', 'O. Fernandes',
];

const series = new Map();
const byGenre = new Map();
const seenTitles = new Set();

// Roughly one in six titles is "new": small play count, often unrated.
for (const file of covers) {
  const title = titleFromFile(file);
  if (!title) continue;
  const key = title.toLowerCase();
  if (seenTitles.has(key)) continue; // duplicate art of the same show
  seenTitles.add(key);

  const genre = genreFor(title, rng);
  const fresh = rng() < 0.17;
  const plays = fresh
    ? Math.floor(2_000 + rng() * 900_000)
    : Math.floor(1_200_000 + rng() ** 2.2 * 1_300_000_000);
  const rated = fresh ? rng() > 0.5 : true;
  const id = slugify(title);

  series.set(id, {
    id,
    title,
    author: authorFromFile(file) ?? (rng() > 0.5 ? pick(rng, AUTHORS) : null),
    image: `/assets/${file}`,
    badge: fmtBadge(plays),
    plays: fmtPlays(plays),
    rating: rated ? (4.1 + rng() * 0.8).toFixed(1) : null,
    genre,
    episodes: Math.floor(40 + rng() * 460),
    ageRating: rng() > 0.35 ? 'U/A 13+' : 'U/A 16+',
    _plays: plays,
    _fresh: fresh,
  });

  if (!byGenre.has(genre)) byGenre.set(genre, []);
  byGenre.get(genre).push(id);
}

/* ------------------------------------------------------------------ rows --- */

const ROW_SPECS = [
  { title: 'Top Picks for You', n: 20 },
  { title: 'Popular on EchoFM', n: 10, variant: 'ranked' },
  { title: 'Top Completed Series', n: 18 },
  { title: 'Top Rated Audio Series', n: 18 },
  { title: 'New Arrivals', n: 18, fresh: true },
  { title: 'Trending This Week', n: 18 },
  { title: 'Emerging Stars', n: 18, fresh: true },
  { title: 'Epic Fantasy', genres: ['Epic Fantasy'], n: 16 },
  { title: 'Thriller & Horror', genres: ['Thriller', 'Horror'], n: 16 },
  { title: 'Wedlock Romance', genres: ['Romance'], n: 16 },
  { title: 'Male Drama', genres: ['Drama', 'Action'], n: 16 },
  { title: 'Eastern Fantasy', genres: ['Eastern Fantasy'], n: 12 },
  { title: 'Female Drama', genres: ['Drama', 'Romance'], n: 16 },
  { title: 'Magical Realism', genres: ['Magical Realism'], n: 12 },
  { title: 'Contemporary Romance', genres: ['Romance'], n: 16 },
  { title: 'Authors in Spotlight', n: 14 },
  { title: 'Horror Thriller', genres: ['Horror', 'Thriller'], n: 14 },
  { title: 'Systems', genres: ['System'], n: 10 },
  { title: 'Action Thriller', genres: ['Action', 'Thriller'], n: 14 },
  { title: 'Mythology', genres: ['Mythology'], n: 14 },
  { title: 'Sci-Fi', genres: ['Sci-Fi'], n: 10 },
];

const allIds = [...series.keys()];
const freshIds = allIds.filter((id) => series.get(id)._fresh);
const evergreenIds = allIds.filter((id) => !series.get(id)._fresh);

const rows = ROW_SPECS.map((spec) => {
  let pool;
  if (spec.fresh) pool = freshIds.length >= 6 ? [...freshIds] : [...allIds];
  else if (spec.genres) pool = spec.genres.flatMap((g) => byGenre.get(g) ?? []);
  else pool = [...evergreenIds];

  if (!pool.length) pool = [...allIds];

  // Deterministic shuffle, then take n.
  let ids = pool
    .map((id) => ({ id, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.id)
    .slice(0, spec.n);

  if (spec.variant === 'ranked' || /^Top /.test(spec.title)) {
    ids = ids.sort((a, b) => series.get(b)._plays - series.get(a)._plays);
  }
  if (spec.title === 'Top Rated Audio Series') {
    ids = ids.sort(
      (a, b) => Number(series.get(b).rating ?? 0) - Number(series.get(a).rating ?? 0),
    );
  }
  return { title: spec.title, variant: spec.variant ?? 'default', ids };
}).filter((r) => r.ids.length > 0);

// Hero: the four biggest titles.
const TAGLINES = [
  'Every empire begins with one refusal.',
  'The debt came due at midnight.',
  'She was promised a throne. She took two.',
  'Some doors only open once.',
];
const heroIds = [...evergreenIds]
  .sort((a, b) => series.get(b)._plays - series.get(a)._plays)
  .slice(0, 4);
heroIds.forEach((id, i) => {
  series.get(id).tagline = TAGLINES[i];
});

/* ----------------------------------------------------------------- write --- */

// Strip internals before serializing.
const clean = Object.fromEntries(
  [...series].map(([id, s]) => {
    const { _plays, _fresh, ...rest } = s;
    return [id, rest];
  }),
);

const ts = `// GENERATED by scripts/build-catalog.mjs — edit that script, not this file.
//
// Demo catalog for the EchoFM home page: titles derived from the cover art in
// public/assets, with seeded play counts and ratings. Phase 2 swaps this module
// for a Lakebase query; the types below are the contract the UI depends on.

export type Series = {
  id: string;
  title: string;
  author: string | null;
  image: string;
  /** Compact overlay badge, e.g. "170M+". */
  badge: string | null;
  /** Full play count shown under the art, e.g. "170.1M". */
  plays: string | null;
  rating: string | null;
  genre: string;
  episodes: number;
  ageRating: string;
  /** Present only on hero titles. */
  tagline?: string;
};

export type Row = {
  title: string;
  variant: 'default' | 'ranked';
  ids: string[];
};

export const SERIES: Record<string, Series> = ${JSON.stringify(clean, null, 2)};

export const ROWS: Row[] = ${JSON.stringify(rows, null, 2)};

/** Titles featured in the hero carousel, in order. */
export const HERO_IDS: string[] = ${JSON.stringify(heroIds, null, 2)};

export function getSeries(id: string): Series {
  const s = SERIES[id];
  if (!s) throw new Error(\`Unknown series: \${id}\`);
  return s;
}

export function seriesFor(ids: string[]): Series[] {
  return ids.map(getSeries);
}
`;

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'series.ts'), ts);

console.log(`covers:  ${covers.length}`);
console.log(`series:  ${series.size}`);
console.log(`rows:    ${rows.length}`);
console.log(
  `genres:  ${[...byGenre].map(([g, v]) => `${g}=${v.length}`).join(', ')}`,
);
console.log(`hero:    ${heroIds.map((h) => series.get(h).title).join(' | ')}`);
