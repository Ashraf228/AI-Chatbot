import { Type } from 'class-transformer';
import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class IntegrationConfigDto {
  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;
}

export class UpdateIntegrationConnectionItemDto {
  @IsString()
  @MaxLength(120)
  providerKey!: string;

  @IsString()
  @MaxLength(120)
  connectionKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsString()
  @IsIn(['connected', 'disconnected'])
  status!: 'connected' | 'disconnected';

  @IsOptional()
  @ValidateNested()
  @Type(() => IntegrationConfigDto)
  config?: IntegrationConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IntegrationConfigDto)
  secrets?: IntegrationConfigDto;
}

export class UpdateIntegrationConnectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateIntegrationConnectionItemDto)
  connections!: UpdateIntegrationConnectionItemDto[];
}
