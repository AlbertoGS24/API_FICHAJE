import { IsEnum } from 'class-validator';

export enum WorkerGroupDto {
  EMPLOYEE = 'EMPLOYEE',
  INTERN = 'INTERN',
}

export class UpdateUserGroupDto {
  @IsEnum(WorkerGroupDto)
  workerGroup!: WorkerGroupDto;
}
