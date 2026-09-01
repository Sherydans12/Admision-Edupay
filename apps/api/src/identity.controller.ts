import {
  AccountRegistrationService,
  buildSessionCookieOptions,
  createOpaqueSessionCookie,
  getCorrelationId,
} from "@admission/database";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";

import { RequestContextService } from "./request-context.service.js";
import {
  parseIdentityBody,
  registerAccountSchema,
  verifyAccountSchema,
} from "./identity-schemas.js";

interface ResponseLike {
  header(name: string, value: string): void;
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      path: string;
      sameSite: "lax" | "none" | "strict";
      secure: boolean;
      maxAge?: number;
    },
  ): void;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

const GENERIC_REGISTRATION_MESSAGE =
  "Si el correo puede utilizarse, revisa tu bandeja para continuar.";

@Controller("auth")
export class IdentityController {
  constructor(
    private readonly identity: AccountRegistrationService,
    private readonly contexts: RequestContextService,
  ) {}

  @Get("session")
  async session(
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    response.header("Cache-Control", "no-store, private");
    return (
      (await this.contexts.getOptionalSessionSnapshot(request)) ?? {
        authenticated: false as const,
      }
    );
  }

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
    response.header("Cache-Control", "no-store, private");
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
      maxAge:
        Math.max(
          0,
          Math.floor(
            (result.session.absoluteExpiresAt.getTime() - Date.now()) / 1000,
          ),
        ) * 1000,
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

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ): Promise<void> {
    response.header("Cache-Control", "no-store, private");
    const current = await this.contexts.getOptionalSessionSnapshot(request);
    if (current !== undefined) {
      await this.contexts.assertMutationSafe(request);
      await this.contexts.revokeCurrentSession(request);
    }

    const environment =
      process.env.NODE_ENV === "production" ? "production" : "local";
    const cookie = buildSessionCookieOptions({ environment });
    response.cookie(cookie.name, "", {
      httpOnly: cookie.httpOnly,
      maxAge: 0,
      path: cookie.path,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    });
  }
}
