FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source files
COPY index.js ./
COPY server.js ./
COPY seed.js ./
COPY scripts ./scripts
COPY prisma ./prisma

# Switch to PostgreSQL schema and generate Prisma client
RUN node scripts/use-production-schema.js
RUN npx prisma generate

# ── Build Admin Dashboard ────────────────────────────────────────────────────
WORKDIR /app/admin-dashboard
COPY admin-dashboard/package*.json ./
RUN npm ci
COPY admin-dashboard/index.html ./
COPY admin-dashboard/vite.config.js ./
COPY admin-dashboard/public ./public
COPY admin-dashboard/src ./src
COPY admin-dashboard/.env.production ./
ENV NODE_ENV=production
RUN npm run build
RUN ls -la dist/

# ── Build Merchant Dashboard ─────────────────────────────────────────────────
WORKDIR /app/merchant-dashboard
COPY merchant-dashboard/package*.json ./
RUN npm ci
COPY merchant-dashboard/index.html ./
COPY merchant-dashboard/vite.config.js ./
COPY merchant-dashboard/public ./public
COPY merchant-dashboard/src ./src
COPY merchant-dashboard/.env.production ./
ENV NODE_ENV=production
RUN npm run build
RUN ls -la dist/

# ── Build POS App ─────────────────────────────────────────────────────────────
WORKDIR /app/pos-app
COPY pos-app/package*.json ./
RUN npm ci
COPY pos-app/index.html ./
COPY pos-app/vite.config.js ./
COPY pos-app/public ./public
COPY pos-app/src ./src
COPY pos-app/.env.production ./
ENV NODE_ENV=production
RUN npm run build
RUN ls -la dist/

# ── Final working directory ───────────────────────────────────────────────────
WORKDIR /app

EXPOSE 10000
CMD ["node", "scripts/start.js"]
