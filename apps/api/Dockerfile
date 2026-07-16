FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM dependencies AS builder
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S pockettrainer && adduser -S pockettrainer -G pockettrainer
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./package.json
USER pockettrainer
EXPOSE 3000
CMD ["node", "dist/main.js"]
