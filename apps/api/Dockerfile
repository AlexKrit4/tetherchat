# syntax=docker/dockerfile:1
# Build context is the repository root: the API needs the shared workspace too.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Prisma's postinstall needs the schema present before install runs.
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @tetherchat/api --workspace @tetherchat/shared --include-workspace-root

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @tetherchat/shared \
  && npm run build --workspace @tetherchat/api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl tini \
  && addgroup -S app && adduser -S app -G app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/src/loadEnv.ts ./apps/api/src/loadEnv.ts

RUN mkdir -p /app/uploads && chown -R app:app /app/uploads
USER app
WORKDIR /app/apps/api
EXPOSE 4000

# Migrations run at boot so a deploy never needs a separate release step.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node ../../node_modules/prisma/build/index.js migrate deploy && node dist/src/index.js"]
