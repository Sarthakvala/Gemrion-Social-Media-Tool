# Built from the repo root (see docker-compose.yml) so the worker shares
# src/lib/assets/paths.ts and src/lib/video/{spec,timing}.ts with the web app.
# Debian, not Alpine: Remotion's docs advise against Alpine (slow Rust start-up).
FROM node:24.16.0-bookworm-slim

# Shared libraries Chrome Headless Shell needs (list from remotion.dev/docs/docker)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
    libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    ca-certificates fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app
# Node runs .ts directly (type stripping); both trees are ES modules
RUN echo '{"type":"module"}' > /app/package.json

WORKDIR /app/worker
COPY worker/package.json worker/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
# the shared files under /app/src resolve packages (zod) from here
RUN ln -s /app/worker/node_modules /app/node_modules

COPY worker/src ./src
COPY worker/remotion ./remotion
COPY src/lib/assets/paths.ts /app/src/lib/assets/paths.ts
COPY src/lib/video/spec.ts src/lib/video/timing.ts /app/src/lib/video/

# Download Chrome Headless Shell at build time, not on every start
RUN npx remotion browser ensure && chown -R node:node /app

USER node
CMD ["node", "src/main.ts"]
