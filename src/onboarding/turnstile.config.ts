type TurnstileConfig = {
  enabled: boolean;
  siteKey: string | null;
  secretKey: string | null;
};

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function normalize(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = normalize(process.env.TURNSTILE_SITE_KEY);
  const secretKey = normalize(process.env.TURNSTILE_SECRET_KEY);
  const enabledRaw = (process.env.TURNSTILE_ENABLED ?? '').trim().toLowerCase();

  const hasKeys = Boolean(siteKey && secretKey);
  let enabled = hasKeys;

  if (TRUE_VALUES.has(enabledRaw)) enabled = true;
  if (FALSE_VALUES.has(enabledRaw)) enabled = false;

  return {
    enabled,
    siteKey,
    secretKey,
  };
}
