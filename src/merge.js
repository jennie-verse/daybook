import { APP_ORDER, SOURCE_APPS } from './sources.js';
export function mergeSourceResults(results, cachedDay = null) {
  const apps = {}; const failures = []; const diagnostics = [];
  for (const source of SOURCE_APPS) {
    const result = results.find((item) => item.app === source.id);
    if (result && !result.error) {
      apps[source.id] = Array.isArray(result.records) ? result.records.map((record) => ({ ...record, app: source.id })) : [];
      diagnostics.push(...(result.diagnostics || []).map((entry) => ({ ...entry, app: source.id })));
    } else {
      failures.push(source.id); apps[source.id] = cachedDay?.apps?.[source.id] || [];
    }
  }
  const records = Object.values(apps).flat().filter((record) => !record.deleted).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (APP_ORDER.get(a.app) ?? 99) - (APP_ORDER.get(b.app) ?? 99) || String(a.id).localeCompare(String(b.id)));
  return { apps, records, failures, diagnostics };
}
export function appIdsWithRecords(day) { return SOURCE_APPS.map(({ id }) => id).filter((id) => day.apps?.[id]?.length); }
