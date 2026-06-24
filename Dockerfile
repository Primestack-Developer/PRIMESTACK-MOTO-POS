FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY prisma ./prisma
COPY src ./src
COPY server.js ./
COPY seed.js ./
COPY admin-dashboard/dist ./admin-dashboard/dist
COPY merchant-dashboard/dist ./merchant-dashboard/dist
COPY pos-app/dist ./pos-app/dist
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "start"]
