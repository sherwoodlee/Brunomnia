import type { KeyValue } from '../types';

export const formatBulkKeyValues = (rows: KeyValue[]) => {
  const lines = rows
    .filter((row) => row.enabled && (row.name || row.value))
    .map((row) => `${row.name}: ${row.value}`);
  return lines.length ? `${lines.join('\n')}\n` : '';
};

export const parseBulkKeyValues = (source: string, createId: (index: number) => string): KeyValue[] => {
  const rows: KeyValue[] = [];
  for (const line of source.split(/\n+/)) {
    const [rawName, rawValue] = line.split(/:(.*)$/);
    const name = (rawName || '').trim();
    const value = (rawValue || '').trim();
    if (!name && !value) continue;
    rows.push({ id: createId(rows.length), name, value, enabled: true });
  }
  return rows;
};
