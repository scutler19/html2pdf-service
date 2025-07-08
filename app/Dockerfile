############  Use Node.js base image with manual Playwright installation ############
FROM node:18-slim

# Add cache busting to avoid Docker layer issues
ARG CACHEBUST=1
ARG BUILD_DATE=unknown

##########  install system dependencies & Playwright #############
WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies with cache busting
RUN echo "Cache bust: ${CACHEBUST}, Build date: ${BUILD_DATE}" && \
    npm install --only=production --no-package-lock && \
    npm install ts-node --no-package-lock && \
    npx playwright install chromium --with-deps

# Copy source code
COPY . .

##########  run the API in-place with ts-node ################
ENV NODE_ENV=production

# Don't set PORT here - let Render set it dynamically
EXPOSE 3000
CMD ["npx", "ts-node", "app.ts"] 