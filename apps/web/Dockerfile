# syntax=docker/dockerfile:1
# Builds the SPA and serves it from nginx. Build context is the repository root.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @tetherchat/web --workspace @tetherchat/shared --include-workspace-root

FROM deps AS build
WORKDIR /app
ARG VITE_API_URL=""
ARG VITE_WS_URL=""
ARG VITE_VAPID_PUBLIC_KEY=""
ARG VITE_LIVEKIT_URL=""
ARG VITE_THEME=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY \
    VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL \
    VITE_THEME=$VITE_THEME
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @tetherchat/shared \
  && npm run build --workspace @tetherchat/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
