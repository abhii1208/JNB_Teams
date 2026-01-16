const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isMidnightUtcString = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.includes('T')) return false;
  const [, timePartRaw = ''] = trimmed.split('T');
  const timePart = timePartRaw.toUpperCase();
  const isMidnight = timePart.startsWith('00:00:00') || timePart.startsWith('00:00');
  const isUtc = timePart.includes('Z') || timePart.includes('+00') || timePart.includes('-00');
  return isMidnight && isUtc;
};

const parseDateInput = (input) => {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes('T') && !isMidnightUtcString(trimmed)) {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const datePart = trimmed.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = Number.parseInt(parts[0], 10);
      const month = Number.parseInt(parts[1], 10) - 1;
      const day = Number.parseInt(parts[2], 10);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return new Date(year, month, day);
      }
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function formatShortDate(input) {
  if (!input) return null;
  const d = parseDateInput(input);
  if (!d || Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()] || '';
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${year}`;
}

export function formatLongDate(input) {
  if (!input) return null;
  const d = parseDateInput(input);
  if (!d || Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()] || '';
  const year = String(d.getFullYear());
  return `${day}-${mon}-${year}`;
}

export { parseDateInput };
export default formatShortDate;
