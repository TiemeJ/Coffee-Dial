const DEFAULT_DELIMITER = ';';

const parseDelimitedText = (text, delimiter) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
};

const detectDelimiter = (text) => {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
};

const normalizeHeader = (header) => header.trim();

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
};

const toInteger = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return Math.round(num);
};

const parseRatio = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw || raw.includes('?')) return null;
  const match = raw.match(/([0-9.,]+)\s*\/\s*([0-9.,]+)/);
  if (!match) return null;
  const denominator = toNumber(match[2]);
  return denominator === null ? null : denominator;
};

const parseBeanconquerorDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const year = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4] || '0', 10);
  const minute = Number.parseInt(match[5] || '0', 10);
  const second = Number.parseInt(match[6] || '0', 10);
  const date = new Date(year, month, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const parseBeanconquerorCSV = (text) => {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimitedText(text, delimiter);
  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] !== undefined ? row[index] : '';
    });
    return record;
  });

  return { headers, records };
};

export const mapBeanconquerorBrews = (records, options = {}) => {
  const nowIso = options.nowIso || new Date().toISOString();
  const results = [];

  records.forEach((record) => {
    const method = (record['Preparation method'] || '').trim();
    const farmer = (record['Bean Type'] || '').trim();
    const grinder = (record['Grinder'] || '').trim();
    const drink = (record['Coffee Type'] || '').trim();
    const notes = (record['Notes'] || '').trim();

    const weight = toNumber(record['Ground Coffee (gr)']);
    const grind = toNumber(record['Grind Setting']);
    const temp = toNumber(record['Brew Temperature']);
    const time = toNumber(record['Time']);
    const rating = toInteger(record['Rating']) || 0;
    const firstDrip = toNumber(record['First drip time']);

    const ratioFromField = parseRatio(record['Brew Ratio']);
    const amountWater = toNumber(record['Amount of water']);
    const ratio = ratioFromField !== null
      ? ratioFromField
      : (weight && amountWater ? Number((amountWater / weight).toFixed(2)) : null);

    const createdAt = parseBeanconquerorDate(record['Creation Date']) || nowIso;

    const hasContent = [method, farmer, grinder, drink, notes].some((value) => value)
      || [weight, grind, temp, time, ratio].some((value) => value !== null);

    if (!hasContent) return;

    results.push({
      roaster: '',
      farmer,
      origin: '',
      variety: '',
      processing: '',
      roastType: '',
      method,
      grinder,
      grind,
      weight,
      ratio,
      time,
      temp: temp !== null ? temp : 'M',
      drink,
      notes,
      improve: '',
      rating,
      isActive: false,
      createdAt,
      updatedAt: createdAt,
      firstDrip: firstDrip !== null ? firstDrip : null
    });
  });

  return results;
};
