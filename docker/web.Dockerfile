# Web image (Next.js standalone output). Build from the repository root:
#   docker build -f docker/web.Dockerfile -t tonir-web .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
# Public values are inlined at build time.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_DEFAULT_LOCALE=ru
ARG NEXT_PUBLIC_MAP_PROVIDER=osm
ARG API_INTERNAL_URL=http://api:4000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_MAP_PROVIDER=$NEXT_PUBLIC_MAP_PROVIDER \
    API_INTERNAL_URL=$API_INTERNAL_URL
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY front ./front
COPY back/package.json ./back/package.json
RUN pnpm install --frozen-lockfile --filter "@market/web..."
RUN pnpm --filter @market/shared build && pnpm --filter @market/web build

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/front/.next/standalone ./
COPY --from=build --chown=node:node /app/front/.next/static ./front/.next/static
COPY --from=build --chown=node:node /app/front/public ./front/public
USER node
EXPOSE 3000
CMD ["node", "front/server.js"]
