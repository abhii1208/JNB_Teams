const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatShortDate(input) {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d)) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()] || '';
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${year}`;
}

export function formatLongDate(input) {
  if (!input) return null;
  let d = input instanceof Date ? input : null;
  if (!d && typeof input === 'string') {
    const trimmed = input.trim();
    const datePart = trimmed.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = Number.parseInt(parts[0], 10);
      const month = Number.parseInt(parts[1], 10) - 1;
      const day = Number.parseInt(parts[2], 10);
      d = new Date(year, month, day);
    } else {
      d = new Date(trimmed);
    }
  }
  if (!d) {
    d = new Date(input);
  }
  if (isNaN(d)) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()] || '';
  const year = String(d.getFullYear());
  return `${day}-${mon}-${year}`;
}

export default formatShortDate;
