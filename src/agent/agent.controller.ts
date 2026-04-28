import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AgentAuthGuard } from './agent-auth.guard';
import { AgentService } from './agent.service';
import type { RequestWithAgent } from './agent-request';

@ApiTags('agent')
@ApiBearerAuth()
@UseGuards(AgentAuthGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('status')
  status(@Req() req: RequestWithAgent) {
    return this.agentService.status(req.agent);
  }

  @Get('company/summary')
  companySummary(@Req() req: RequestWithAgent) {
    return this.agentService.companySummary(req.agent);
  }

  @ApiQuery({ name: 'limit', required: false, example: '20' })
  @Get('requests/pending')
  pendingRequests(@Req() req: RequestWithAgent, @Query('limit') limit?: string) {
    return this.agentService.pendingRequests(req.agent, limit);
  }

  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @Get('shifts/today')
  todayShifts(@Req() req: RequestWithAgent, @Query('limit') limit?: string) {
    return this.agentService.todayShifts(req.agent, limit);
  }

  @ApiQuery({ name: 'month', required: false, example: '2026-04' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({
    name: 'userEmail',
    required: false,
    example: 'empleado@empresa.com',
  })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @Get('schedule/month')
  scheduleMonth(
    @Req() req: RequestWithAgent,
    @Query('month') month?: string,
    @Query('userId') userId?: string,
    @Query('userEmail') userEmail?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentService.scheduleMonth(req.agent, {
      month,
      userId,
      userEmail,
      limit,
    });
  }
}
