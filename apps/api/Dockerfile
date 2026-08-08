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

COPY apps/api apps/api
RUN pnpm --filter @admission/api build
RUN pnpm deploy --legacy --filter @admission/api --prod /runtime

FROM node:22.18.0-bookworm-slim AS runtime

LABEL com.admissionedupay.readiness="DEVELOPMENT READINESS IMAGE"

ENV NODE_ENV=development
WORKDIR /app

COPY --from=build /runtime/ ./
COPY --from=build /repo/apps/api/dist ./dist

USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
