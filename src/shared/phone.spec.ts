import { BadRequestException } from '@nestjs/common';
import { normalizeInternationalPhone } from './phone';

describe('normalizeInternationalPhone', () => {
  it('keeps valid international phones in E.164-like format', () => {
    expect(normalizeInternationalPhone('+34 600 111 222')).toBe('+34600111222');
  });

  it('adds Spain prefix to 9-digit local phones', () => {
    expect(normalizeInternationalPhone('600-111-222')).toBe('+34600111222');
  });

  it('converts 00 prefix to international plus prefix', () => {
    expect(normalizeInternationalPhone('0034 600 111 222')).toBe(
      '+34600111222',
    );
  });

  it('returns null for empty values', () => {
    expect(normalizeInternationalPhone('   ')).toBeNull();
  });

  it('rejects invalid phones', () => {
    expect(() => normalizeInternationalPhone('123')).toThrow(
      BadRequestException,
    );
  });
});
