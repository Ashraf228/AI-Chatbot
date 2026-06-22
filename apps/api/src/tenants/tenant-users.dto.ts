import { IsBoolean, IsEmail, IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export const TENANT_USER_ROLES = ['owner', 'admin', 'manager', 'editor', 'viewer'] as const;
export type TenantUserRole = (typeof TENANT_USER_ROLES)[number];

export class CreateTenantUserDto {
  @IsString()
  @MaxLength(120)
  tenantId!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(160)
  displayName!: string;

  @IsOptional()
  @IsString()
  @IsIn(TENANT_USER_ROLES)
  role?: TenantUserRole;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  @IsISO8601()
  @MaxLength(80)
  expiresAt?: string | null;
}

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsString()
  @IsIn(TENANT_USER_ROLES)
  role?: TenantUserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  @IsISO8601()
  @MaxLength(80)
  expiresAt?: string | null;
}

export class AuthenticateTenantUserDto {
  @IsString()
  @MaxLength(120)
  tenantId!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(255)
  password!: string;
}
