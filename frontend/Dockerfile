FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable during build time so Next.js can bake it in (if required)
# Or configure Next.js to use runtime environment variables
# For docker-compose, we can just build it normally and pass env vars at runtime.
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# You only need to copy next.config.ts if you are NOT using the standalone output
# Since Next.js 12+, it's recommended to use output: 'standalone' in next.config.js
# but I'll stick to the standard build for now if it's not configured.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "start"]
