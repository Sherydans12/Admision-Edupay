import {
  AccountRegistrationService,
  buildSessionCookieOptions,
  createOpaqueSessionCookie,
  getCorrelationId,
} from "@admission/database";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";

import {
  parseIdentityBody,
  registerAccountSchema,
  verifyAccountSchema,
} from "./identity-schemas.js";

interface ResponseLike {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      path: string;
      sameSite: "lax" | "none" | "strict";
      secure: boolean;
    },
  ): void;
}

const GENERIC_REGISTRATION_MESSAGE =
  "Si el correo puede utilizarse, revisa tu bandeja para continuar.";

@Controller("auth")
export class IdentityController {
  constructor(private readonly identity: AccountRegistrationService) {}

  @Post("register")
  @HttpCode(HttpStatus.ACCEPTED)
  async register(@Body() body: unknown) {
    const input = parseIdentityBody(registerAccountSchema, body);
    await this.identity.register(input);
    return {
      correlationId: getCorrelationId() ?? "unbound-request",
      message: GENERIC_REGISTRATION_MESSAGE,
    };
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const input = parseIdentityBody(verifyAccountSchema, body);
    const result = await this.identity.verify(input);
    const environment =
      process.env.NODE_ENV === "production" ? "production" : "local";
    const cookie = createOpaqueSessionCookie(
      result.session.token,
      buildSessionCookieOptions({ environment }),
    );
    response.cookie(cookie.name, cookie.value, {
      httpOnly: cookie.options.httpOnly,
      path: cookie.options.path,
      sameSite: cookie.options.sameSite,
      secure: cookie.options.secure,
    });
    return {
      correlationId: getCorrelationId() ?? "unbound-request",
      message: "Cuenta verificada.",
      verified: true,
    };
  }
}
