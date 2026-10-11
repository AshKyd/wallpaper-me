# Deployment

The app is a static single page app served at `wallpapers.kyd.au` by static-web-server behind Traefik.

- [Dockerfile](../Dockerfile): builds with `node:26-alpine` (`npm ci`, `npm run build`, output in `build/`), then copies `build/` into `joseluisq/static-web-server:2-alpine`. `git` is installed in the build stage because `svelte-akui` comes from GitHub.
- It runs as user `10001`, not root, on port `8787`.
- `SERVER_FALLBACK_PAGE=/public/index.html` sends any path that isn't a file to the app, so a reload of `/circles?p=3` works.
- `SERVER_COMPRESSION=false`: Traefik does the compression, so it isn't done twice.
- [docker-compose.yml](../docker-compose.yml): `container_name` is the domain. The router is `wallpapers` on `websecure` with `tls.certresolver=le`, on the external `traefik_default` network (`traefik.docker.network=traefik_default`). The `wallpapers-compress` middleware uses `zstd` and `gzip`.
- Run it with `docker compose up -d --build`.
- [.dockerignore](../.dockerignore) keeps `node_modules`, build output and local profiling files out of the build context.
