import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage, safeNext, toQuery } from './api';

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/account/offers?x=1')).toBe('/account/offers?x=1');
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])('rejects %s', (value) => {
    expect(safeNext(value)).toBe('/');
  });
  it('falls back when empty', () => {
    expect(safeNext(undefined)).toBe('/');
  });
});

describe('toQuery', () => {
  it('skips empty values and encodes the rest', () => {
    expect(toQuery({ q: 'a b', status: '', page: 2, none: undefined })).toBe('?q=a+b&page=2');
  });
  it('is empty when nothing is set', () => {
    expect(toQuery({ q: '' })).toBe('');
  });
});

describe('errorMessage', () => {
  it('shows the API message', () => {
    expect(errorMessage(new ApiError(409, 'CONFLICT', 'Already sold'))).toBe('Already sold');
  });
});
