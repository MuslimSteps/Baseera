import { searchDorarApiLive, searchDorarFiqhLive } from '../src/lib/dorarClient.ts';
import { searchDorarAqeedahLive, searchDorarTafsirLive } from '../src/lib/dorarEncyclopediaClient.ts';
import { searchJamharaLive } from '../src/lib/jamharaClient.ts';
import { getAvailableTranslationLanguages, getAyahTranslations, getHafsMushaf } from '../src/lib/quranpediaClient.ts';
import { fetchRemoteSafely, readTextWithLimit } from '../src/lib/safeRemoteFetch.ts';

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

async function run(
  name: string,
  fn: () => Promise<unknown>,
  summarize: (value: any) => string
): Promise<void> {
  try {
    const value: any = await fn();
    const ok = Boolean(value);
    checks.push({ name, ok, detail: ok ? summarize(value) : 'no result' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

async function discoverFirstLink(
  indexUrl: string,
  pathPattern: RegExp
): Promise<{ title: string; url: string } | null> {
  const response = await fetchRemoteSafely(indexUrl, {
    headers: {
      'User-Agent': 'Baseera/1.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ar,en;q=0.9'
    }
  });
  if (!response.ok) return null;

  const html = await readTextWithLimit(response, 1_500_000);
  const matches = [...html.matchAll(
    new RegExp(`<a\\b[^>]*href=["']([^"']*${pathPattern.source}[^"']*)["'][^>]*>([\\s\\S]*?)</a>`, 'gi')
  )];

  for (const match of matches) {
    const href = match[1] || '';
    const title = (match[2] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
       .replace(/\s+/g, ' ')
      .trim();

    if (title.length < 3) continue;
    return {
      title,
      url: href.startsWith('http') ? href : new URL(href, indexUrl).toString()
    };
  }

  return null;
}

const [dorarHadithSeed, dorarFiqhSeed, dorarTafsirSeed, dorarAqeedahSeed, jamharaSeed, mushaf] =
  await Promise.all([
    discoverFirstLink('https://dorar.net/hadith', /\/hadith\//),
    discoverFirstLink('https://dorar.net/feqhia', /\/feqhia\/\d+/),
    discoverFirstLink('https://dorar.net/tafseer', /\/tafseer\/\d+/),
    discoverFirstLink('https://dorar.net/aqeeda', /\/aqeeda\/\d+/),
    discoverFirstLink('https://islamic-content.com/dictionary', /\/dictionary\/word\/\d+/),
    getHafsMushaf()
  ]);

await run(
  'Dorar Hadith — dynamic source discovery',
  async () => dorarHadithSeed ? searchDorarApiLive(dorarHadithSeed.title.split(/\s+/).slice(0, 3).join(' ')) : [],
  (value: any[]) => 'results=' + (Array.isArray(value) ? value.length : 0)
);

await run(
  'Dorar Fiqh — dynamic source discovery',
  async () => dorarFiqhSeed ? searchDorarFiqhLive(dorarFiqhSeed.title) : null,
  (value: any) => 'found=' + Boolean(value?.found) + ' url=' + (value?.url || '')
);

await run(
  'Dorar Tafsir — dynamic source discovery',
  async () => dorarTafsirSeed ? searchDorarTafsirLive(dorarTafsirSeed.title) : null,
  (value: any) => 'found=' + Boolean(value?.found) + ' url=' + (value?.url || '')
);

await run(
  'Dorar Aqeedah — dynamic source discovery',
  async () => dorarAqeedahSeed ? searchDorarAqeedahLive(dorarAqeedahSeed.title) : null,
  (value: any) => 'found=' + Boolean(value?.found) + ' url=' + (value?.url || '')
);

await run(
  'Jamhara — dynamic source discovery',
  async () => jamharaSeed ? searchJamharaLive(jamharaSeed.title) : null,
  (value: any) => 'found=' + Boolean(value?.found) + ' url=' + (value?.url || '')
);

const firstAyah = mushaf?.surahs?.[0]?.ayahs?.[0];

await run(
  'Quranpedia translation language discovery',
  async () => firstAyah ? getAvailableTranslationLanguages(firstAyah.surah, firstAyah.number) : [],
  (value: any[]) => 'languages=' + (Array.isArray(value) ? value.length : 0)
);

await run(
  'Quranpedia all available translations for discovered ayah',
  async () => firstAyah ? getAyahTranslations(firstAyah.surah, firstAyah.number) : [],
  (value: any) => {
    const groups = value && typeof value === 'object' ? Object.entries(value) : [];
    const nonEmpty = groups.filter(([, rows]: any) =>
      Array.isArray(rows) && rows.some((row: any) => row?.text)
    ).length;
    return 'languages_with_text=' + nonEmpty;
  }
);

const passed = checks.filter(x => x.ok).length;
console.log('\n=== BASEERA LIVE SOURCE SMOKE TEST ===');
for (const check of checks) {
  console.log((check.ok ? 'PASS ' : 'FAIL ') + check.name + ' — ' + check.detail);
}
console.log('\nPassed: ' + passed + '/' + checks.length);
if (checks.some(x => !x.ok)) process.exit(1);
