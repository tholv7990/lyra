import { parseCsv, parseMarketplaceCsv } from './marketplace.fetcher';

describe('parseCsv (RFC-4180)', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    expect(parseCsv('act,"a, b, c",x')).toEqual([['act', 'a, b, c', 'x']]);
  });

  it('handles doubled-quote escaping inside a quoted field', () => {
    expect(parseCsv('"she said ""hi""",end')).toEqual([
      ['she said "hi"', 'end'],
    ]);
  });

  it('handles embedded newlines inside a quoted field', () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseMarketplaceCsv', () => {
  const sample = [
    'act,prompt,for_devs,type,contributor',
    'Linux Terminal,"I want you to act as a linux terminal, with commas",TRUE,STRUCTURED,@f',
    '"Tweet, please","write a tweet about ""AI""",false,text,',
    'Empty,,false,text,', // dropped — blank prompt
  ].join('\n');

  it('maps columns and types from a quoted/comma/newline sample', () => {
    const rows = parseMarketplaceCsv(sample);
    expect(rows).toHaveLength(2);

    expect(rows[0]).toEqual({
      act: 'Linux Terminal',
      prompt: 'I want you to act as a linux terminal, with commas',
      forDevs: true,
      type: 'STRUCTURED',
      contributor: '@f',
    });

    expect(rows[1].act).toBe('Tweet, please');
    expect(rows[1].prompt).toBe('write a tweet about "AI"');
    expect(rows[1].forDevs).toBe(false);
    expect(rows[1].contributor).toBe('');
  });

  it('returns [] for header-only or empty input', () => {
    expect(parseMarketplaceCsv('act,prompt,for_devs,type,contributor')).toEqual([]);
    expect(parseMarketplaceCsv('')).toEqual([]);
  });
});
