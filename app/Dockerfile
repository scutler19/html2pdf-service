############  Use Playwright base image with cache busting ############
FROM mcr.microsoft.com/playwright:v1.53.0-jammy

# Add cache busting to avoid Docker layer issues
ARG CACHEBUST=1

##########  install dependencies & copy source #############
WORKDIR /app

# Copy package files first for better caching
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies with cache busting
RUN echo "Cache bust: ${CACHEBUST}" && \
    npm install --only=production --no-package-lock && \
    npm install ts-node --no-package-lock

# Copy source code
COPY . .

##########  run the API in-place with ts-node ################
ENV NODE_ENV=production

# Don't set PORT here - let Render set it dynamically
EXPOSE 3000
CMD ["npx", "ts-node", "app.ts"] 