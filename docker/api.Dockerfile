# API image (NestJS). Build from the repository root:
#   docker build -f docker/api.Dockerfile -t tonir-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY back ./back
COPY front/package.json ./front/package.json
RUN pnpm install --frozen-lockfile --filter "@market/api..."
RUN pnpm --filter @market/shared build && pnpm --filter @market/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/back
RUN chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start. (In multi-replica deployments run migrations as a separate job.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
