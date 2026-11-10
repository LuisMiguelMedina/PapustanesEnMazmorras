import { describe, expect, it } from 'vitest';
import { parseHexColor, parseRgbColor, resolveCustomEventColor } from './calendarCustomColor';

describe('calendarCustomColor', () => {
  it('normaliza hex', () => {
    expect(parseHexColor('#f00')).toBe('#ff0000');
    expect(parseHexColor('38b6ff')).toBe('#38b6ff');
  });

  it('parsea RGB', () => {
    expect(parseRgbColor('255, 128, 0')).toBe('rgb(255, 128, 0)');
    expect(parseRgbColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
  });

  it('resuelve según modo', () => {
    expect(resolveCustomEventColor('hex', '#aabbcc', { r: '0', g: '0', b: '0' })).toBe('#aabbcc');
    expect(resolveCustomEventColor('rgb', '#000', { r: '12', g: '34', b: '56' })).toBe(
      'rgb(12, 34, 56)',
    );
  });
});
