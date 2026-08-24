FROM node:22.18.0-bookworm-slim AS build

ARG IMAGE_READINESS="PRODUCTION CANDIDATE IMAGE"
LABEL com.admissionedupay.readiness=$IMAGE_READINESS

ENV COREPACK_HOME=/corepack
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

COPY packages/database packages/database
RUN DATABASE_MIGRATION_URL=postgresql://admission_migrator:admission_migrator_local_only@localhost:5432/admission_dev pnpm --filter @admission/database db:generate
RUN pnpm --filter @admission/database build

COPY apps/api apps/api
RUN pnpm --filter @admission/api build
RUN pnpm deploy --legacy --filter @admission/api --prod /runtime

FROM node:22.18.0-bookworm-slim AS runtime

ARG IMAGE_READINESS="PRODUCTION CANDIDATE IMAGE"
ARG RUNTIME_NODE_ENV=production
LABEL com.admissionedupay.readiness=$IMAGE_READINESS

ENV NODE_ENV=$RUNTIME_NODE_ENV
ENV PORT=3001
WORKDIR /app

RUN mkdir -p /app/document-storage && chown node:node /app/document-storage

COPY --from=build /runtime/ ./
COPY --from=build /repo/apps/api/dist ./dist

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health/ready').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main.js"]
