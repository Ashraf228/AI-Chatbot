import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

function secureCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-admin-key'];
    const expected = process.env.ADMIN_KEY?.trim();

    if (
      typeof key !== 'string' ||
      !expected ||
      expected.length < 32 ||
      !secureCompare(key, expected)
    ) {
      throw new UnauthorizedException('admin key required');
    }

    return true;
  }
}
