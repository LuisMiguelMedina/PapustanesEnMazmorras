export type CustomColorInputMode = 'hex' | 'rgb';

export function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

/** Normaliza hex: `#RGB`, `#RRGGBB`, `RRGGBB`. */
export function parseHexColor(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
    const h = withHash.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return withHash.toLowerCase();
  }
  return null;
}

export function hexToRgbComponents(hex: string): { r: number; g: number; b: number } | null {
  const parsed = parseHexColor(hex);
  if (!parsed) return null;
  const h = parsed.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbComponentsToCss(r: number, g: number, b: number): string {
  return `rgb(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)})`;
}

/** Acepta `255, 128, 0` o `rgb(255, 128, 0)`. */
export function parseRgbColor(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const match = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (match) {
    return rgbComponentsToCss(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  const csv = raw.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (csv) {
    return rgbComponentsToCss(Number(csv[1]), Number(csv[2]), Number(csv[3]));
  }
  return null;
}

export function parseCssColorToMode(
  css: string,
): { mode: CustomColorInputMode; hex: string; rgb: { r: string; g: string; b: string } } | null {
  if (!css || css.includes('gradient')) return null;
  const hex = parseHexColor(css);
  if (hex) {
    const comp = hexToRgbComponents(hex);
    if (!comp) return null;
    return {
      mode: 'hex',
      hex,
      rgb: { r: String(comp.r), g: String(comp.g), b: String(comp.b) },
    };
  }
  const rgbCss = parseRgbColor(css);
  if (rgbCss) {
    const m = rgbCss.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return null;
    const hexFromRgb = `#${[m[1], m[2], m[3]]
      .map((n) => clampByte(Number(n)).toString(16).padStart(2, '0'))
      .join('')}`;
    return {
      mode: 'rgb',
      hex: hexFromRgb,
      rgb: { r: m[1], g: m[2], b: m[3] },
    };
  }
  return null;
}

export function resolveCustomEventColor(
  mode: CustomColorInputMode,
  hexInput: string,
  rgb: { r: string; g: string; b: string },
): string | null {
  if (mode === 'hex') {
    return parseHexColor(hexInput);
  }
  const r = Number(rgb.r);
  const g = Number(rgb.g);
  const b = Number(rgb.b);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return rgbComponentsToCss(r, g, b);
}
