# ── Stage 1: build esm-clinomix-app and esm-home-app ──────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY .yarn/releases/ .yarn/releases/
COPY .yarnrc.yml package.json yarn.lock tsconfig.json ./
COPY packages/esm-clinomix-app/ packages/esm-clinomix-app/
COPY packages/esm-home-app/     packages/esm-home-app/

RUN yarn workspaces focus @openmrs/esm-clinomix-app @openmrs/esm-home-app

# ForkTsCheckerWebpackPlugin is disabled in esm-clinomix-app/webpack.config.js
RUN yarn workspace @openmrs/esm-clinomix-app build
RUN yarn workspace @openmrs/esm-home-app build

# ── Stage 2: assemble the SPA directory ────────────────────────────────────
FROM node:20-alpine AS shell

WORKDIR /app
COPY --from=builder /app /app

RUN set -e; \
    # Start from the pre-built app shell (contains index.html, CSS, JS, fonts)
    cp -r /app/node_modules/@openmrs/esm-app-shell/dist/. /spa/; \
    \
    # Copy each package's dist into its own subdirectory
    mkdir -p /spa/esm-clinomix-app /spa/esm-home-app; \
    cp -r /app/packages/esm-clinomix-app/dist/. /spa/esm-clinomix-app/; \
    cp -r /app/packages/esm-home-app/dist/.      /spa/esm-home-app/; \
    \
    # Build the import map — use absolute paths to avoid SystemJS resolution ambiguity
    node -e " \
      const fs = require('fs'); \
      const path = require('path'); \
      const imports = {}; \
      ['esm-clinomix-app', 'esm-home-app'].forEach(dir => { \
        const pkg = JSON.parse(fs.readFileSync('/app/packages/' + dir + '/package.json', 'utf8')); \
        imports[pkg.name] = '/openmrs/spa/' + dir + '/' + path.basename(pkg.browser); \
      }); \
      fs.writeFileSync('/spa/importmap.json', JSON.stringify({ imports }, null, 2)); \
    "; \
    \
    # Build routes.registry.json — each module's routes nested under its package name
    node -e " \
      const fs = require('fs'); \
      const path = require('path'); \
      const registry = {}; \
      ['esm-clinomix-app', 'esm-home-app'].forEach(dir => { \
        const f = '/spa/' + dir + '/routes.json'; \
        if (!fs.existsSync(f)) return; \
        const pkg = JSON.parse(fs.readFileSync('/app/packages/' + dir + '/package.json', 'utf8')); \
        const routes = JSON.parse(fs.readFileSync(f, 'utf8')); \
        delete routes['\$schema']; \
        registry[pkg.name] = routes; \
      }); \
      fs.writeFileSync('/spa/routes.registry.json', JSON.stringify(registry, null, 2)); \
    "; \
    \
    # Patch index.html: replace the hardcoded dev3.openmrs.org importmap URL
    # with the local relative path served by nginx
    sed -i 's|https://dev3.openmrs.org/openmrs/spa/importmap.json|/openmrs/spa/importmap.json|g' /spa/index.html

# ── Stage 3: serve with nginx ──────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=shell /spa /usr/share/nginx/html/openmrs/spa
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
