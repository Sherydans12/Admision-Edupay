import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { isDocumentsFeatureEnabled } from "@admission/database";

@Injectable()
export class DocumentsFeatureGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isDocumentsFeatureEnabled()) {
      throw new ForbiddenException();
    }
    return true;
  }
}
