import {
  AssistanceService as DatabaseAssistanceService,
  PrismaClient,
} from "@admission/database";
import { Injectable } from "@nestjs/common";

import { ApiDocumentService } from "./document.service.js";
import { ApiFormService } from "./form.service.js";

@Injectable()
export class ApiAssistanceService extends DatabaseAssistanceService {
  constructor(
    prisma: PrismaClient,
    forms: ApiFormService,
    documents: ApiDocumentService,
  ) {
    super(prisma, forms, documents);
  }
}
