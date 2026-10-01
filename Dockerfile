# syntax=docker/dockerfile:1
# One image recipe for the Node services. From the repo root:
#   docker build --build-arg APP=api --build-arg PORT=3000 .
#   docker build --build-arg APP=game-server --build-arg PORT=2567 .
#   docker build --build-arg APP=db .   (runs the migrations, then exits)

ARG NODE_IMAGE=node:26.10.0-alpine3.24

FROM ${NODE_IMAGE} AS base
RUN npm install --global pnpm@12.6.0 turbo@2.11.5

# 1. Keep only the app and the workspace packages it needs.
FROM base AS prune
ARG APP
WORKDIR /repo
COPY . .
RUN turbo prune "@mathgo/${APP}" --docker

# 2. Install (cached until a package.json or the lockfile changes), build, and bundle the app
#    with its production dependencies into /deploy.
FROM base AS build
ARG APP
WORKDIR /repo
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
RUN turbo run build --filter="@mathgo/${APP}"
RUN pnpm deploy --filter="@mathgo/${APP}" --prod --legacy /deploy

# 3. Runtime: just Node, the built app and its dependencies, as a non-root user.
FROM ${NODE_IMAGE} AS runtime
ARG PORT=8080
ENV NODE_ENV=production PORT=${PORT}
WORKDIR /app
COPY --from=build --chown=node:node /deploy .
USER node
EXPOSE ${PORT}
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/index.js"]
