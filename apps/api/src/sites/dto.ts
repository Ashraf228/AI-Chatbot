import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export type SiteConfigInput = Record<string, unknown>;

export class CreateSiteDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() siteKey?: string;
  @IsString() tenantId!: string;     // required
  @IsString() name!: string;
  @IsArray() allowedDomains!: string[];
  @IsOptional() @IsObject() config?: SiteConfigInput;
}
