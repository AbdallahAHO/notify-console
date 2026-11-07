# syntax=docker/dockerfile:1
# notify-console: build the SPA, serve it with nginx. NOTIFY_API_URL (runtime) becomes /config.json.

FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.29-alpine
# nginx's entrypoint runs /docker-entrypoint.d/*.sh before starting
COPY docker/40-notify-config.sh /docker-entrypoint.d/40-notify-config.sh
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
