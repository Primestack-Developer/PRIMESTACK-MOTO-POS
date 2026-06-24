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

# Base stage
FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM base AS production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY prisma ./prisma
COPY src ./src
COPY server.js ./
COPY seed.js ./
COPY scripts ./scripts

# Copy built dashboards from build stages
COPY --from=admin-dashboard-build /app/admin-dashboard/dist ./admin-dashboard/dist
COPY --from=merchant-dashboard-build /app/merchant-dashboard/dist ./merchant-dashboard/dist
COPY --from=pos-app-build /app/pos-app/dist ./pos-app/dist

RUN node scripts/use-production-schema.js
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "start"]