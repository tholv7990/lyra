import { subjectKey } from './request.views';

// subjectKey is what lets the future voting board collapse duplicate requests
// onto one votable item — so its normalization is worth pinning down.
describe('subjectKey', () => {
  it('normalizes case, surrounding space, and inner whitespace', () => {
    expect(subjectKey('Google Gemini')).toBe('google gemini');
    expect(subjectKey('  gemini ')).toBe('gemini');
    expect(subjectKey('Google   Gemini')).toBe('google gemini');
    expect(subjectKey('GROQ')).toBe('groq');
  });

  it('collapses tabs/newlines to single spaces', () => {
    expect(subjectKey('open\trouter')).toBe('open router');
    expect(subjectKey('a\n\nb')).toBe('a b');
  });
});
