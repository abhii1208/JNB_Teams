export function sanitizeFilename(input) {
  const name = String(input || 'export').trim();
  const sanitized = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return sanitized || 'export';
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers, rows) {
  const headerLine = (headers || []).map(escapeCsvCell).join(',');
  const lines = (rows || []).map((row) => (row || []).map(escapeCsvCell).join(','));
  return [headerLine, ...lines].join('\r\n');
}

export function downloadCsv({ filename, headers, rows }) {
  const safeName = sanitizeFilename(filename);
  const withExt = safeName.toLowerCase().endsWith('.csv') ? safeName : `${safeName}.csv`;
  const csv = `\uFEFF${toCsv(headers, rows)}`; // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = withExt;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

