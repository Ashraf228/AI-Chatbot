import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class UpdateSiteModuleItemDto {
  @IsString()
  key!: string;

  @IsBoolean()
  isEnabled!: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateSiteModulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSiteModuleItemDto)
  modules!: UpdateSiteModuleItemDto[];
}
