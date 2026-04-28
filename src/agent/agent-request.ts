import type { Request } from 'express';

export type AgentScope =
  | 'read:summary'
  | 'read:requests'
  | 'read:shifts'
  | 'read:schedule';

export type AgentContext = {
  integrationId: string;
  provider: 'OPENCLAW';
  companyId: string;
  scopes: string[];
  company: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
};

export type RequestWithAgent = Request & {
  agent: AgentContext;
};
