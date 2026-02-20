import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @IsString() id!: string; // your siteId
  @IsString() name!: string;
  @IsArray() allowedDomains!: string[];
  @IsOptional() config?: any;
}