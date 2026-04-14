import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @IsString() id!: string;
  @IsString() tenantId!: string;     // required
  @IsString() name!: string;
  @IsArray() allowedDomains!: string[];
  @IsOptional() config?: any;
}