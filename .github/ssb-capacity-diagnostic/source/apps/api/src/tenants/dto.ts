import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MaxLength(120)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
