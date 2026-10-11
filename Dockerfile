# syntax=docker/dockerfile:1

# --- Build the static site ---
FROM node:26-alpine AS build
# svelte-akui is installed from GitHub, which needs git.
RUN apk add --no-cache git
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json .npmrc ./
RUN npm ci
COPY --chown=node:node . .
# adapter-static writes the site, with its index.html fallback, to /app/build.
RUN npm run build

# --- Serve it with static-web-server ---
FROM joseluisq/static-web-server:2-alpine
COPY --from=build --chown=10001:10001 /app/build /public

# Not root: a numeric id works without creating a user, and the port is above 1024 so no privileges are needed.
USER 10001:10001
ENV SERVER_PORT=8787 \
    SERVER_ROOT=/public \
    # Single page app: any path that isn't a file (e.g. /circles?p=3) gets the app.
    SERVER_FALLBACK_PAGE=/public/index.html \
    # Traefik compresses (gzip and zstd), so the server doesn't do it twice.
    SERVER_COMPRESSION=false \
    SERVER_LOG_LEVEL=warn
EXPOSE 8787
