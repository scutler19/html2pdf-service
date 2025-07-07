############  base image with Playwright + Node ############
FROM mcr.microsoft.com/playwright:v1.53.0-jammy

##########  install dependencies & copy source #############
WORKDIR /app

# Clear any existing cache and install dependencies
RUN rm -rf node_modules package-lock.json

# Copy package files first for better caching
COPY package.json ./
COPY package-lock.json* ./
COPY tsconfig.json ./

# Install dependencies with cache busting
RUN npm ci --only=production && npm install ts-node

# Copy source code
COPY . .

##########  run the API in-place with ts-node ################
ENV NODE_ENV=production

# Don't set PORT here - let Render set it dynamically
EXPOSE 3000
CMD ["npx", "ts-node", "app.ts"] 