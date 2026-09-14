# ---- build stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Toolchain needed to compile the native better-sqlite3 binding if no prebuilt is available.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/package.json
COPY packages/web/package.json ./packages/web/package.json
RUN npm ci

COPY packages ./packages
RUN npm run build

# ---- runtime stage ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/package.json
COPY packages/web/package.json ./packages/web/package.json
RUN npm ci --omit=dev

# Compiled API + its migrations, and the built web bundle.
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist

# Data directory for the SQLite database, owned by the unprivileged runtime user.
#
# Ownership here is load-bearing, not cosmetic. The app enables WAL, which needs
# write access to the DIRECTORY (for the -wal and -shm sidecar files), not just
# the database file. A named volume is initialised from the image's directory, so
# creating it node-owned is what lets the non-root process write to the volume.
# Handing back a root-owned volume would fail at startup with SQLITE_CANTOPEN.
RUN mkdir -p /app/packages/api/data && chown -R node:node /app/packages/api/data

# Drop privileges. The image ships a built-in unprivileged `node` user (uid 1000).
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "packages/api/dist/index.js"]
