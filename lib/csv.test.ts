import { describe, expect, it } from 'vitest';
import { CSV_BOM, toCsv } from './csv';

describe('toCsv', () => {
  it('starts with a BOM and keeps Thai text intact', () => {
    const csv = toCsv(['queue_label', 'name'], [{ queue_label: 'ส้ม-27', name: 'ฝ้าย' }]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('ส้ม-27,ฝ้าย');
    expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });
  it('quotes commas, quotes and line breaks; writes objects as JSON', () => {
    const csv = toCsv(['a', 'b', 'c'], [{ a: 'x,y', b: 'say "hi"', c: { n: 1 } }]);
    expect(csv).toContain('"x,y","say ""hi""","{""n"":1}"');
  });
  it('leaves null and missing values empty', () => {
    expect(toCsv(['a', 'b'], [{ a: null }])).toContain('\r\n,\r\n');
  });
});
