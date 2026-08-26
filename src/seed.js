'use strict';
const fs = require('fs');
const path = require('path');

const namesMap = {
  'home-page': { uid: 'api::home-page.home-page', isSingle: true, localized: true },
  'cookie-page': { uid: 'api::cookie-page.cookie-page', isSingle: true, localized: true },
  'terms-and-conditions-page': { uid: 'api::terms-and-conditions-page.terms-and-conditions-page', isSingle: true, localized: true },
  'privacy-policy': { uid: 'api::privacy-policy.privacy-policy', isSingle: true, localized: true },
  'thank-you-page': { uid: 'api::thank-you-page.thank-you-page', isSingle: true, localized: true },
  'support-page': { uid: 'api::support-page.support-page', isSingle: true, localized: true },
  'contacts': { uid: 'api::contact.contact', isSingle: false, localized: false },
  'paymany-contacts': { uid: 'api::paymany-contact.paymany-contact', isSingle: false, localized: false },
};

function extractMediaFiles(obj, mediaMap) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    for (const item of obj) extractMediaFiles(item, mediaMap);
  } else if (typeof obj === 'object') {
    if ('data' in obj && obj.data !== null) {
      const items = Array.isArray(obj.data) ? obj.data : [obj.data];
      for (const it of items) {
        if (it && it.id && it.attributes && it.attributes.url) {
          mediaMap[String(it.id)] = { id: it.id, ...it.attributes };
        }
      }
    }
    for (const val of Object.values(obj)) {
      extractMediaFiles(val, mediaMap);
    }
  }
}

function cleanEntryData(data, mediaIdMap = {}) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => cleanEntryData(item, mediaIdMap));
  }
  if (typeof data === 'object') {
    const cleaned = {};
    for (const [key, val] of Object.entries(data)) {
      if (['id', 'createdAt', 'updatedAt', 'publishedAt', 'localizations'].includes(key)) {
        continue;
      }
      if (val && typeof val === 'object' && 'data' in val) {
        if (val.data === null) {
          cleaned[key] = null;
        } else if (Array.isArray(val.data)) {
          cleaned[key] = val.data
            .map(d => (d && d.id && mediaIdMap[String(d.id)] ? mediaIdMap[String(d.id)] : null))
            .filter(Boolean);
        } else if (val.data && val.data.id && mediaIdMap[String(val.data.id)]) {
          cleaned[key] = mediaIdMap[String(val.data.id)];
        } else {
          cleaned[key] = null;
        }
      } else {
        cleaned[key] = cleanEntryData(val, mediaIdMap);
      }
    }
    return cleaned;
  }
  return data;
}

module.exports = async function seed(strapi) {
  try {
    console.log('[Seed] Starting permissions setup and cloud data sync...');

    // 1. Setup Public Role Permissions
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' }
    });

    if (publicRole) {
      const permissions = await strapi.query('plugin::users-permissions.permission').findMany({
        where: { role: publicRole.id }
      });
      const existingActions = new Set(permissions.map(p => p.action));

      const actionsToEnable = [];
      for (const info of Object.values(namesMap)) {
        actionsToEnable.push(`${info.uid}.find`);
        actionsToEnable.push(`${info.uid}.findOne`);
      }
      actionsToEnable.push('api::contact.contact.create');
      actionsToEnable.push('api::paymany-contact.paymany-contact.create');

      for (const action of actionsToEnable) {
        if (!existingActions.has(action)) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action,
              role: publicRole.id
            }
          });
        }
      }
      console.log('[Seed] Public role permissions enabled successfully.');
    }

    // 2. Ensure 'ro' and 'en' locales exist
    try {
      const locales = await strapi.plugins['i18n'].services.locales.find();
      const existingCodes = new Set(locales.map(l => l.code));

      if (!existingCodes.has('ro')) {
        await strapi.plugins['i18n'].services.locales.create({
          code: 'ro',
          name: 'Romanian (ro)',
          isDefault: false
        });
        console.log('[Seed] Added "ro" locale.');
      }
      if (!existingCodes.has('en')) {
        await strapi.plugins['i18n'].services.locales.create({
          code: 'en',
          name: 'English (en)',
          isDefault: true
        });
        console.log('[Seed] Added "en" locale.');
      }
    } catch (e) {
      console.warn('[Seed] Locale creation notice:', e.message);
    }

    // 3. Load dumped cloud data
    const dumpPath = path.join(__dirname, 'cloud_data_all.json');
    if (!fs.existsSync(dumpPath)) {
      console.log('[Seed] No cloud_data_all.json found. Skipping content seed.');
      return;
    }

    const cloudData = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

    // 4. Seed Media Files
    const mediaFilesRaw = {};
    extractMediaFiles(cloudData, mediaFilesRaw);
    const mediaIdMap = {};

    for (const [rawId, m] of Object.entries(mediaFilesRaw)) {
      try {
        let existing = await strapi.query('plugin::upload.file').findOne({
          where: { hash: m.hash }
        });
        if (!existing) {
          existing = await strapi.query('plugin::upload.file').create({
            data: {
              name: m.name,
              alternativeText: m.alternativeText || '',
              caption: m.caption || '',
              width: m.width,
              height: m.height,
              formats: m.formats,
              hash: m.hash,
              ext: m.ext,
              mime: m.mime,
              size: m.size,
              url: m.url,
              previewUrl: m.previewUrl,
              provider: m.provider || 'cloudinary',
              provider_metadata: m.provider_metadata
            }
          });
        }
        mediaIdMap[String(rawId)] = existing.id;
      } catch (e) {
        console.warn(`[Seed] Error seeding media file ${m.name}:`, e.message);
      }
    }
    console.log(`[Seed] Seeded ${Object.keys(mediaIdMap).length} media files.`);

    // 5. Seed Content Types
    for (const [ep, info] of Object.entries(namesMap)) {
      const roItem = cloudData.ro?.[ep]?.data;
      const enItem = cloudData.en?.[ep]?.data;

      // Clean existing records to avoid duplicates on re-run
      try {
        await strapi.db.query(info.uid).deleteMany({ where: {} });
      } catch (e) {}

      if (info.isSingle) {
        // Single Type (en)
        try {
          if (enItem && enItem.attributes) {
            const cleanedEn = cleanEntryData(enItem.attributes, mediaIdMap);
            cleanedEn.locale = 'en';
            cleanedEn.publishedAt = new Date();
            await strapi.entityService.create(info.uid, { data: cleanedEn });
            console.log(`[Seed] Seeded single type (en): ${ep}`);
          }
        } catch (e) {
          console.warn(`[Seed] Error seeding single type en ${ep}:`, e.message);
        }

        // Single Type (ro)
        try {
          if (roItem && roItem.attributes) {
            const cleanedRo = cleanEntryData(roItem.attributes, mediaIdMap);
            cleanedRo.locale = 'ro';
            cleanedRo.publishedAt = new Date();
            await strapi.entityService.create(info.uid, { data: cleanedRo });
            console.log(`[Seed] Seeded single type (ro): ${ep}`);
          }
        } catch (e) {
          console.warn(`[Seed] Error seeding single type ro ${ep}:`, e.message);
        }
      } else {
        // Collection Types (contacts, paymany-contacts)
        // Use db.query to bypass afterCreate email hooks during initial seed
        const items = Array.isArray(roItem) && roItem.length > 0 ? roItem : (Array.isArray(enItem) ? enItem : []);
        try {
          if (items.length > 0) {
            for (const item of items) {
              if (!item.attributes) continue;
              const cleaned = cleanEntryData(item.attributes, mediaIdMap);
              cleaned.publishedAt = new Date();
              await strapi.db.query(info.uid).create({ data: cleaned });
            }
            console.log(`[Seed] Seeded collection type (${items.length} items): ${ep}`);
          }
        } catch (e) {
          console.warn(`[Seed] Error seeding collection ${ep}:`, e.message);
        }
      }
    }

    console.log('[Seed] Content seeding completed successfully!');
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
  }
};
