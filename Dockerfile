# Production image for the Strapi backend.
# The dev image (Dockerfile.dev) mounts source and runs `yarn develop`; this one
# builds the admin panel ahead of time and runs `strapi start`.

# ─── Stage 1: Build (admin panel + native modules) ───────────────────────────
FROM node:20-alpine AS builder

RUN apk update && apk add --no-cache \
    build-base gcc autoconf automake libtool \
    zlib-dev libpng-dev nasm vips-dev git

WORKDIR /opt/app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

ENV NODE_ENV=production
RUN yarn build

ARG PRUNE_LEVEL=safe
RUN sh scripts/prune-node-modules.sh "$PRUNE_LEVEL"

# Verify CLI loads
RUN node node_modules/@strapi/strapi/bin/strapi.js version \
 && echo "post-prune: strapi CLI loads"

# ─── Stage 2: Production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache vips vips-cpp

WORKDIR /opt/app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

COPY --from=builder --chown=node:node /opt/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /opt/app/build ./build
COPY --from=builder --chown=node:node /opt/app/config ./config
COPY --from=builder --chown=node:node /opt/app/database ./database
COPY --from=builder --chown=node:node /opt/app/src ./src
COPY --from=builder --chown=node:node /opt/app/public ./public
COPY --from=builder --chown=node:node /opt/app/package.json ./package.json
COPY --from=builder --chown=node:node /opt/app/favicon.png ./favicon.png

USER node

EXPOSE 1337

CMD ["yarn", "start"]
