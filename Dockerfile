# syntax=docker/dockerfile:1

# ============================================================
#  MedConnecte — Frontend (Next.js 16 + React 19)
#  Multi-stage : base → deps → (dev | build → prod)
#  NB : les variables NEXT_PUBLIC_* sont inlinées dans le bundle client
#       AU MOMENT DU BUILD → elles sont passées en build args pour l'image prod.
# ============================================================

# ---------- base ----------
FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- dev : hot-reload (code monté en volume via compose.override.yml) ----------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- build : `next build` avec les NEXT_PUBLIC_* injectées ----------
FROM base AS build
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- prod : `next start` ----------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/.next        ./.next
COPY --from=build /app/public       ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start"]
