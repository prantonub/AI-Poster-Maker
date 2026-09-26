# Backend Dockerfile — includes Chromium + the system libraries Puppeteer
# needs to launch it headlessly. Works on Render, Railway, Fly.io, or any
# Docker-based host.
#
# Build context: this Dockerfile lives in /backend and expects to be built
# with /backend as the build context, e.g.:
#   docker build -f backend/Dockerfile -t poster-maker-api ./backend

FROM node:20-slim AS base

# System deps for headless Chromium (the actual browser Puppeteer launches),
# plus proper Bangla font packages. Without fonts-beng/fonts-beng-extra,
# Bangla conjuncts fail to shape correctly and every poster's text renders
# as broken/disjointed glyphs instead of proper Bangla script.
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-beng \
    fonts-beng-extra \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    ca-certificates \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's own Chromium download — we use the apt-installed one above.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]
