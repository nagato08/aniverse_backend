import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'ZO44bPd3LB6SdTgaLo7I9OIxQSKfp1_u3l_ri6hJmXw',
    };

    super(options);
  }

  /**
   * La valeur retournée ici devient `req.user`.
   * On renvoie un shape stable: `{ userId, email }`.
   */
  validate(payload: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return { userId: payload.sub as string, email: payload.email as string };
  }
}
