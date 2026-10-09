import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CaptureLeadDto {
  @IsString()
  @MaxLength(120)
  siteKey!: string;

  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsIn(['new', 'contacted', 'qualified', 'closed'])
  status?: 'new' | 'contacted' | 'qualified' | 'closed';
}
