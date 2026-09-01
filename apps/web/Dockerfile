FROM node:22.18.0-bookworm-slim AS build

ARG IMAGE_READINESS="PRODUCTION CANDIDATE IMAGE"
ARG NEXT_PUBLIC_ADMISSION_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_ADMISSION_TENANT_ID=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
ARG NEXT_PUBLIC_ADMISSION_DOCUMENTS_ENABLED=true
LABEL com.admissionedupay.readiness=$IMAGE_READINESS

ENV COREPACK_HOME=/corepack
ENV NEXT_PUBLIC_ADMISSION_API_URL=$NEXT_PUBLIC_ADMISSION_API_URL
ENV NEXT_PUBLIC_ADMISSION_TENANT_ID=$NEXT_PUBLIC_ADMISSION_TENANT_ID
ENV NEXT_PUBLIC_ADMISSION_DOCUMENTS_ENABLED=$NEXT_PUBLIC_ADMISSION_DOCUMENTS_ENABLED
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @admission/web build

FROM node:22.18.0-bookworm-slim AS runtime

ARG IMAGE_READINESS="PRODUCTION CANDIDATE IMAGE"
ARG RUNTIME_NODE_ENV=production
LABEL com.admissionedupay.readiness=$IMAGE_READINESS

ENV NODE_ENV=$RUNTIME_NODE_ENV
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
