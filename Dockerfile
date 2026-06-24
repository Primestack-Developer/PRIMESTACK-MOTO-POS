FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy and install backend dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY index.js ./
COPY server.js ./
COPY seed.js ./
COPY scripts ./scripts
COPY prisma ./prisma

# Switch to PostgreSQL schema
RUN node scripts/use-production-schema.js

# Generate Prisma client
RUN npx prisma generate

# Build Admin Dashboard
COPY admin-dashboard/package*.json ./admin-dashboard/
RUN cd admin-dashboard && npm ci
COPY admin-dashboard ./admin-dashboard
RUN cd admin-dashboard && npm run build

# Build Merchant Dashboard
COPY merchant-dashboard/package*.json ./merchant-dashboard/
RUN cd merchant-dashboard && npm ci
COPY merchant-dashboard ./merchant-dashboard
RUN cd merchant-dashboard && npm run build

# Build POS App
COPY pos-app/package*.json ./pos-app/
RUN cd pos-app && npm ci
COPY pos-app ./pos-app
RUN cd pos-app && npm run build

# Verify dist files exist
RUN ls -la admin-dashboard/dist/ && ls -la merchant-dashboard/dist/ && ls -la pos-app/dist/

EXPOSE 3000

CMD ["node", "scripts/start.js"]
