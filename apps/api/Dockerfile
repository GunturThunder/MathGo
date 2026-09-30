# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/api/Dockerfile .

FROM node:26.10.0-alpine3.24 AS base
RUN npm install --global pnpm@12.6.0 turbo@2.11.5

# 1. Keep only the api and the workspace packages it needs.
FROM base AS prune
WORKDIR /repo
COPY . .
RUN turbo prune @mathgo/api --docker

# 2. Install (cached until a package.json or the lockfile changes), build, and bundle the api
#    with its production dependencies into /deploy.
FROM base AS build
WORKDIR /repo
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
RUN turbo run build --filter=@mathgo/api
RUN pnpm deploy --filter=@mathgo/api --prod --legacy /deploy

# 3. Runtime: just Node, the built api and its dependencies, as a non-root user.
FROM node:26.10.0-alpine3.24 AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /deploy .
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/index.js"]
