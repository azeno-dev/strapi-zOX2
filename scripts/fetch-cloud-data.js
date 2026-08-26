const fs = require('fs');
const path = require('path');

const token = process.env.STRAPI_API_TOKEN || 'aeddd73e5ff1b21becd0cd5da8feb0f83d91e83dbbc720fc5cce2230e393b3bf5fbd1094c95be34d724f3c39e8fef9989b6ab52be7bb211441d49963c5745ba6a449e647d9eee4fa0eaad66bb0a535e2e31d170eda06d65bc55840e27606ea40fba6d85f1d26d1052f333d921f0491afdd26e2b4a78a327584185097baabe123';
const baseUrl = process.env.STRAPI_CLOUD_URL || 'https://equilibrum.up.railway.app/api';

const endpoints = [
  'home-page',
  'cookie-page',
  'terms-and-conditions-page',
  'privacy-policy',
  'thank-you-page',
  'support-page',
  'contacts',
  'paymany-contacts'
];

async function fetchCloudData() {
  console.log('[Fetch] Fetching data from cloud Strapi:', baseUrl);
  const dump = { ro: {}, en: {} };

  for (const locale of ['ro', 'en']) {
    for (const ep of endpoints) {
      try {
        const url = `${baseUrl}/${ep}?locale=${locale}&populate=deep`;
        const res = await fetch(url, {
          headers: {
            Authorization: `${token}`
          }
        });
        if (!res.ok) {
          console.warn(`[Fetch] Failed for ${ep} (${locale}): HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        dump[locale][ep] = data;
        console.log(`[Fetch] Successfully fetched ${ep} (${locale})`);
      } catch (err) {
        console.error(`[Fetch] Error fetching ${ep} (${locale}):`, err.message);
      }
    }
  }

  const destPath = path.join(__dirname, '../src/cloud_data_all.json');
  fs.writeFileSync(destPath, JSON.stringify(dump, null, 2));
  console.log('[Fetch] Successfully saved cloud dump to:', destPath);
}

fetchCloudData();
