import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator';

export const OPENCLAW_AGENT_SCOPES = [
  'read:summary',
  'read:requests',
  'read:shifts',
  'read:schedule',
] as const;

export type OpenClawAgentScope = (typeof OPENCLAW_AGENT_SCOPES)[number];

export class RotateOpenClawTokenDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(OPENCLAW_AGENT_SCOPES, { each: true })
  scopes?: OpenClawAgentScope[];
}
