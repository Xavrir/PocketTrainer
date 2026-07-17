FROM node:24-alpine AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @pockettrainer/api...

COPY apps/api ./apps/api
RUN pnpm --filter @pockettrainer/api build
RUN pnpm --filter @pockettrainer/api deploy --prod --legacy /opt/pockettrainer-api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S pockettrainer && adduser -S pockettrainer -G pockettrainer
COPY --from=builder --chown=pockettrainer:pockettrainer /opt/pockettrainer-api ./
USER pockettrainer
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||3000;fetch(`http://127.0.0.1:${port}/health/ready`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
