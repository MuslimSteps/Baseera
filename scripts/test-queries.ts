import dotenv from 'dotenv';
dotenv.config();

async function testQuery(query: string) {
  console.log('\n======================================================');
  console.log('TESTING QUERY:', query);
  const start = Date.now();
  const res = await fetch('http://127.0.0.1:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: query })
  });
  const data = await res.json();
  const elapsed = Date.now() - start;
  const item = data.report?.verifications?.[0] || data.results?.[0];
  console.log('Elapsed:', elapsed, 'ms');
  console.log('Status Label:', item?.status_label_ar);
  console.log('Source Name:', item?.citation?.source_name);
  console.log('Book / Chapter:', item?.citation?.book);
  console.log('Authority:', item?.citation?.authority);
  console.log('URL:', item?.citation?.url);
  console.log('Canonical Evidence:', (item?.canonical_text || '').slice(0, 180));
  console.log('Reason:', (item?.reason || '').slice(0, 200));
}

(async () => {
  try {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    await testQuery('ما حكم الكذب؟');
    await sleep(1000);
    await testQuery('ما حكم اللغو؟');
    await sleep(1000);
    await testQuery('ما حكم الختان؟');
    await sleep(1000);
    await testQuery('تفسير سورة الفاتحة');
    await sleep(1000);
    await testQuery('ما هو توحيد الألوهية؟');
    await sleep(1000);
    await testQuery('الاستصحاب');
    await sleep(1000);
    await testQuery('وَلَا أُقْسِمُ بِالنَّفْسِ اللَّوَّامَةِ');
    process.exit(0);
  } catch (err) {
    console.error('Error running test queries:', err);
    process.exit(1);
  }
})();
