const fs = require('fs');
const path = require('path');

const token = process.env.STRAPI_API_TOKEN || 'e3c5b2cd5794df8f5c89b69bdfc40e068772635d7f171d1d08848f33e5b03ceefac305c6d15bf0929fd0b1f590f0cb034b720eb0e3e3f1e6ad7492fab28555cd3b115136e825b61515f5885e1dcecb9501359924f4503563aaab338f83505f46e904ba3622c49962b046da163f9633345044a4e1122f3ec7c045879665871c3b';
const rawBaseUrl = process.env.STRAPI_CLOUD_URL || 'https://admin.equilibrum.ngo/api';
const baseUrl = rawBaseUrl.replace(/\/+$/, '');

const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

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

  // Determine available locales from cloud
  let locales = ['en', 'ro'];
  try {
    const locRes = await fetch(`${baseUrl}/i18n/locales`, {
      headers: { Authorization: authHeader }
    });
    if (locRes.ok) {
      const locData = await locRes.json();
      if (Array.isArray(locData) && locData.length > 0) {
        locales = locData.map(l => l.code);
        console.log('[Fetch] Found cloud locales:', locales);
      }
    }
  } catch (e) {
    console.warn('[Fetch] Could not query /i18n/locales, defaulting to [en, ro]:', e.message);
  }

  for (const locale of locales) {
    if (!dump[locale]) dump[locale] = {};
    for (const ep of endpoints) {
      try {
        const url = `${baseUrl}/${ep}?locale=${locale}&populate=deep`;
        const res = await fetch(url, {
          headers: { Authorization: authHeader }
        });
        if (!res.ok) {
          console.warn(`[Fetch] Notice for ${ep} (${locale}): HTTP ${res.status}`);
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

  // If ro is not present on cloud, fall back to en data so local ro routes also work
  if (!dump.ro || Object.keys(dump.ro).length === 0) {
    dump.ro = JSON.parse(JSON.stringify(dump.en || {}));
    console.log('[Fetch] Populated ro with en fallback.');
  }

  const destPath = path.join(__dirname, '../src/cloud_data_all.json');
  fs.writeFileSync(destPath, JSON.stringify(dump, null, 2));
  console.log('[Fetch] Successfully saved cloud dump to:', destPath);
}

fetchCloudData();
