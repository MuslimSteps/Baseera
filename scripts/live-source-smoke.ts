import { searchDorarApiLive, searchDorarFiqhLive } from '../src/lib/dorarClient.ts';
import { searchDorarAqeedahLive, searchDorarTafsirLive } from '../src/lib/dorarEncyclopediaClient.ts';
import { searchJamharaLive } from '../src/lib/jamharaClient.ts';
import { getAvailableTranslationLanguages, getAyahTranslations } from '../src/lib/quranpediaClient.ts';

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

async function run(name: string, fn: () => Promise<unknown>, summarize: (value: any) => string): Promise<void> {
  try {
    const value: any = await fn();
    const ok = Boolean(value);
    checks.push({ name, ok, detail: ok ? summarize(value) : 'no result' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

await run(
  'Dorar Hadith',
  () => searchDorarApiLive('إنما الأعمال بالنيات'),
  (value: any[]) => 'results=' + (Array.isArray(value) ? value.length : 0)
);
await run(
  'Dorar Fiqh',
  () => searchDorarFiqhLive('نقض الوضوء بلمس المرأة'),
  (value: any) => 'found=' + Boolean(value?.found)
);

await run(
  'Dorar Fiqh — ruling intent regression',
  () => searchDorarFiqhLive('ما حكم الختان؟'),
  (value: any) => 'found=' + Boolean(value?.found) + ' title=' + (value?.title || '') + ' url=' + (value?.url || '')
);
await run(
  'Dorar Fiqh — wudu ruling regression',
  () => searchDorarFiqhLive('ما حكم الوضوء؟'),
  (value: any) => 'found=' + Boolean(value?.found) + ' title=' + (value?.title || '') + ' url=' + (value?.url || '')
);
await run(
  'Dorar Tafsir',
  () => searchDorarTafsirLive('تفسير سورة الفاتحة'),
  (value: any) => 'found=' + Boolean(value?.found) + ' url=' + (value?.url || '')
);
await run(
  'Dorar Aqeedah',
  () => searchDorarAqeedahLive('التوحيد'),
  (value: any) => 'found=' + Boolean(value?.found) + ' url=' + (value?.url || '')
);
await run(
  'Jamhara',
  () => searchJamharaLive('التوحيد'),
  (value: any) => 'found=' + Boolean(value?.found) + ' url=' + (value?.url || '')
);
await run(
  'Quranpedia translation language discovery',
  () => getAvailableTranslationLanguages(1, 1),
  (value: any[]) => 'languages=' + (Array.isArray(value) ? value.length : 0)
);
await run(
  'Quranpedia all available translations for ayah',
  () => getAyahTranslations(1, 1),
  (value: any) => {
    const groups = value && typeof value === 'object' ? Object.entries(value) : [];
    const nonEmpty = groups.filter(([, rows]: any) => Array.isArray(rows) && rows.some((row: any) => row?.text)).length;
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
