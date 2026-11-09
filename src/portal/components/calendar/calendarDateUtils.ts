/** Suma días a una fecha ISO (YYYY-MM-DD) en horario local. */
export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Días entre dos fechas ISO (fin - inicio). */
export function daysBetweenIso(startIso: string, endIso: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((parse(endIso) - parse(startIso)) / (1000 * 60 * 60 * 24));
}

export function uniqueIsoDates(dates: string[]): string[] {
  return Array.from(new Set(dates.filter(Boolean)));
}
