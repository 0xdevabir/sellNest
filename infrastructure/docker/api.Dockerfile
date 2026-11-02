# Serves the API, the worker and one-off database tasks from one image.
# Prisma and tsx stay installed because migrations and the seed run from this image.
FROM node:24-bookworm-slim AS build
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl ca-certificates >/dev/null \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --fetch-retries=6 --fetch-timeout=120000 --filter '@sellnest/api...'
RUN pnpm --filter @sellnest/shared build \
  && pnpm --filter @sellnest/api exec prisma generate \
  && pnpm --filter @sellnest/api build

FROM node:24-bookworm-slim
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl ca-certificates >/dev/null \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production TZ=Asia/Dhaka
WORKDIR /repo
COPY --from=build --chown=node:node /repo ./
USER node
WORKDIR /repo/apps/api
EXPOSE 4100
CMD ["node", "dist/main.js"]
