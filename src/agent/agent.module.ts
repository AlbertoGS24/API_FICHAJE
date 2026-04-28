import { Module } from '@nestjs/common';
import { AgentAuthGuard } from './agent-auth.guard';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  controllers: [AgentController],
  providers: [AgentAuthGuard, AgentService],
})
export class AgentModule {}
