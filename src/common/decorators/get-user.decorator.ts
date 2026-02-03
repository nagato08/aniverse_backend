/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Récupère `req.user` injecté par Passport (via JwtStrategy).
 *
 * Exemple:
 * - `me(@GetUser() user: { userId: string; email: string })`
 *
 * Si tu modifies `validate()` dans `JwtStrategy`, adapte aussi ce type.
 */
export const GetUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // `request.user` est défini par passport-jwt quand le token est valide
    return request.user as { userId: string; email: string };
  },
);
