import {
  AuditReadService,
  PrismaClient,
  ReportingService,
  RoleAssignmentAdminService,
} from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiReportingService extends ReportingService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}

@Injectable()
export class ApiRoleAssignmentAdminService extends RoleAssignmentAdminService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}

@Injectable()
export class ApiAuditReadService extends AuditReadService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
