FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter '@sellnest/web...'
# NODE_ENV must be production here: a development value breaks prerendering of the error pages.
RUN pnpm --filter @sellnest/shared build && NODE_ENV=production pnpm --filter @sellnest/web exec next build

FROM node:24-bookworm-slim
ENV NODE_ENV=production TZ=Asia/Dhaka HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
