# syntax=docker/dockerfile:1.7
# One build context, one image per service:
#   docker build --target gateway -t ev-charging-gateway:local .
#   docker build --target socket  -t ev-charging-socket:local .
ARG NODE_IMAGE=node:22.23.5-bookworm-slim

# ---- build: all workspaces' dependencies, compile both services ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY src/gateway/package.json src/gateway/
COPY src/subgraphs/socket/package.json src/subgraphs/socket/
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY tsconfig.base.json ./
COPY src ./src
RUN npm run build

# ---- production dependencies of one workspace each ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY src/gateway/package.json src/gateway/
COPY src/subgraphs/socket/package.json src/subgraphs/socket/

FROM deps AS gateway-deps
RUN npm ci --omit=dev --workspace=@ev-charging/gateway --no-audit --no-fund --ignore-scripts \
 && rm -rf node_modules/@ev-charging \
 && npm cache clean --force

FROM deps AS socket-deps
RUN npm ci --omit=dev --workspace=@ev-charging/socket-subgraph --no-audit --no-fund --ignore-scripts \
 && rm -rf node_modules/@ev-charging \
 && npm cache clean --force

# ---- runtime base: no compiler, no package managers, non-root ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
# The services never run npm, so drop it (and its bundled dependencies, the
# source of the base image's CVE findings) together with corepack and yarn.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
# Code stays root-owned and read-only to the process; nothing is written at runtime.
USER node
# Both services answer GraphQL on every path; `{ __typename }` proves the server is serving.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/',{method:'POST',headers:{'content-type':'application/json'},body:'{\"query\":\"{__typename}\"}'}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# node runs as PID 1 and handles SIGTERM/SIGINT itself (graceful shutdown in src/index.ts).
CMD ["node", "build/index.js"]

FROM runtime AS socket
ENV PORT=4001
COPY --from=socket-deps /app/node_modules ./node_modules
COPY --from=build /app/src/subgraphs/socket/build ./build
COPY src/subgraphs/socket/package.json ./
EXPOSE 4001

# Last stage, so a plain `docker build .` produces the gateway.
FROM runtime AS gateway
ENV PORT=4000
COPY --from=gateway-deps /app/node_modules ./node_modules
COPY --from=build /app/src/gateway/build ./build
COPY src/gateway/package.json ./
EXPOSE 4000
