# Stage 1
FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY . .
RUN NODE_ENV=production pnpm run build

# Stage 2
FROM nginx:alpine

LABEL org.opencontainers.image.title="vSMR-Sim-Web" \
      org.opencontainers.image.source="https://github.com/ETRI-vSMR/vsmr-sim-web"

# Install envsubst (from gettext) for runtime variable substitution
RUN apk add --no-cache gettext

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy config files for runtime defaults
COPY config/defaults.sh /app/config/defaults.sh

# Copy runtime env template and entrypoint helper
COPY public/env.template.js /usr/share/nginx/html/env.template.js
COPY docker/50-envsubst.sh /docker-entrypoint.d/50-envsubst.sh
RUN chmod +x /docker-entrypoint.d/50-envsubst.sh

# Nginx config (SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
