FROM node:22.18.0-bookworm-slim AS build

LABEL com.admissionedupay.readiness="DEVELOPMENT READINESS IMAGE"

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

COPY apps/worker apps/worker
RUN pnpm --filter @admission/worker build
RUN pnpm deploy --legacy --filter @admission/worker --prod /runtime

FROM node:22.18.0-bookworm-slim AS runtime

LABEL com.admissionedupay.readiness="DEVELOPMENT READINESS IMAGE"

ENV NODE_ENV=development
WORKDIR /app

RUN mkdir -p /app/document-storage && chown node:node /app/document-storage

COPY --from=build /runtime/ ./
COPY --from=build /repo/apps/worker/dist ./dist

USER node
CMD ["node", "dist/main.js"]
