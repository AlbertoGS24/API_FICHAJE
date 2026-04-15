type CompanyOnboardingConfig = {
  publicSelfRegisterEnabled: boolean;
  publicDevToolsEnabled: boolean;
};

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBooleanEnv(
  rawValue: string | undefined,
  fallback: boolean,
): boolean {
  const normalized = rawValue?.trim().toLowerCase() ?? '';
  if (!normalized) return fallback;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

export function getCompanyOnboardingConfig(): CompanyOnboardingConfig {
  return {
    publicSelfRegisterEnabled: parseBooleanEnv(
      process.env.PUBLIC_COMPANY_SELF_REGISTER_ENABLED,
      false,
    ),
    publicDevToolsEnabled: parseBooleanEnv(
      process.env.PUBLIC_DEV_TOOLS_ENABLED,
      false,
    ),
  };
}
