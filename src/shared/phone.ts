import { BadRequestException } from '@nestjs/common';

const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function normalizeInternationalPhone(
  value: string | null | undefined,
): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  let normalized = raw.replace(/[\s().-]+/g, '');
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (/^[6789]\d{8}$/.test(normalized)) {
    normalized = `+34${normalized}`;
  }

  if (!INTERNATIONAL_PHONE_REGEX.test(normalized)) {
    throw new BadRequestException(
      'El teléfono debe guardarse en formato internacional, por ejemplo +34600111222',
    );
  }

  return normalized;
}
