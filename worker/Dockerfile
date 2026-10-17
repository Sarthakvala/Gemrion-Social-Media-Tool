# Built from the repo root (see docker-compose.yml) so the worker can share
# src/lib/assets/paths.ts with the web app instead of duplicating it.
FROM node:24.16.0-slim

ENV NODE_ENV=production
WORKDIR /app

# Node runs .ts directly (type stripping); both trees are ES modules
RUN echo '{"type":"module"}' > /app/package.json

WORKDIR /app/worker
COPY worker/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY worker/src ./src
COPY src/lib/assets/paths.ts /app/src/lib/assets/paths.ts

USER node
CMD ["node", "src/main.ts"]
