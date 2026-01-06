export function formatShortDate(input) {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d)) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[d.getMonth()] || '';
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${year}`;
}

export default formatShortDate;
