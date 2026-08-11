import { PrismaClient, RecommendationService } from "@admission/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiRecommendationService extends RecommendationService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}
