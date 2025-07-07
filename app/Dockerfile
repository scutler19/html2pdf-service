############  Use standard Node.js base image ############
FROM node:18-slim

##########  Install system dependencies for Playwright #############
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

##########  install dependencies & copy source #############
WORKDIR /app

# Copy package files first for better caching
COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.json ./

# Install dependencies and Playwright
RUN npm ci --only=production && \
    npm install ts-node && \
    npx playwright install chromium

# Copy source code
COPY . .

##########  run the API in-place with ts-node ################
ENV NODE_ENV=production

# Don't set PORT here - let Render set it dynamically
EXPOSE 3000
CMD ["npx", "ts-node", "app.ts"] 