export type CsvPreview = { delimiter: string; error: string; rows: string[][]; truncated: boolean };

const delimiters = [',', '\t', ';', '|'];

const detectDelimiter = (text: string) => {
  const counts = new Map(delimiters.map((delimiter) => [delimiter, 0]));
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && (character === '\n' || character === '\r')) break;
    if (!quoted && counts.has(character)) counts.set(character, counts.get(character)! + 1);
  }
  return delimiters.reduce((best, candidate) => counts.get(candidate)! > counts.get(best)! ? candidate : best, ',');
};

export const parseCsvPreview = (
  text: string,
  limits: { maxRows?: number; maxColumns?: number; maxCells?: number } = {},
): CsvPreview => {
  const delimiter = detectDelimiter(text);
  const maxRows = Math.max(1, Math.trunc(limits.maxRows ?? 10_000));
  const maxColumns = Math.max(1, Math.trunc(limits.maxColumns ?? 200));
  const maxCells = Math.max(1, Math.trunc(limits.maxCells ?? 250_000));
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let truncated = false;
  let stopped = false;
  let cells = 0;

  const pushValue = () => {
    if (row.length < maxColumns) row.push(value);
    else truncated = true;
    value = '';
  };
  const pushRow = () => {
    if (!row.some((cell) => cell.length)) { row = []; return true; }
    if (rows.length >= maxRows || cells + row.length > maxCells) { truncated = true; return false; }
    rows.push(row);
    cells += row.length;
    row = [];
    return true;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === delimiter) pushValue();
    else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      pushValue();
      if (!pushRow()) { stopped = true; break; }
    } else value += character;
  }

  if (quoted) return { delimiter, error: 'CSV contains an unterminated quoted field.', rows: [], truncated: false };
  if (!stopped && (value || row.length)) { pushValue(); pushRow(); }
  return { delimiter, error: '', rows, truncated };
};
