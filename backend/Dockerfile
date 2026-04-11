FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ── Dependencies ───────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Build (generate Prisma client) ─────────────────
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate

# ── Production image ───────────────────────────────
FROM base AS production
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S skillswap -u 1001

COPY --from=deps  --chown=skillswap:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=skillswap:nodejs /app/src          ./src
COPY --from=build --chown=skillswap:nodejs /app/prisma       ./prisma
COPY --chown=skillswap:nodejs package*.json ./

RUN mkdir -p logs && chown skillswap:nodejs logs

USER skillswap
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "src/server.js"]
