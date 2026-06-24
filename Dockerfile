# Build admin dashboard
FROM node:20-slim AS admin-dashboard-build
WORKDIR /app/admin-dashboard
COPY admin-dashboard/package*.json ./
RUN npm ci
COPY admin-dashboard ./
RUN npm run build

# Build merchant dashboard
FROM node:20-slim AS merchant-dashboard-build
WORKDIR /app/merchant-dashboard
COPY merchant-dashboard/package*.json ./
RUN npm ci
COPY merchant-dashboard ./
RUN npm run build

# Build pos app
FROM node:20-slim AS pos-app-build
WORKDIR /app/pos-app
COPY pos-app/package*.json ./
RUN npm ci
COPY pos-app ./
RUN npm run build

# Base stage — install production dependencies
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:20-slim AS production
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl

# Copy node_modules
COPY --from=base /app/node_modules ./node_modules

# Copy all app source files
COPY package*.json ./
COPY prisma ./prisma
COPY index.js ./
COPY server.js ./
COPY seed.js ./
COPY scripts ./scripts

# Copy built frontend apps
COPY --from=admin-dashboard-build /app/admin-dashboard/dist ./admin-dashboard/dist
COPY --from=merchant-dashboard-build /app/merchant-dashboard/dist ./merchant-dashboard/dist
COPY --from=pos-app-build /app/pos-app/dist ./pos-app/dist

# Switch to PostgreSQL schema and generate Prisma client
RUN node scripts/use-production-schema.js
RUN npx prisma generate

EXPOSE 3000
CMD ["node", "scripts/start.js"]
