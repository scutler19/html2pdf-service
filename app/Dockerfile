############  base image with Playwright + Node ############
ARG image=mcr.microsoft.com/playwright:v1.53.0-jammy
FROM ${image}

##########  install dependencies & copy source #############
WORKDIR /app

# 1. copy manifests and install ALL deps (prod + dev, we need ts-node)
COPY package*.json tsconfig.json ./
RUN npm install

# 2. copy *all* source files (controllers/, routes/, config/, etc.)
COPY . .

##########  run the API in-place with ts-node ################
ENV NODE_ENV=production

# Don't set PORT here - let Render set it dynamically
EXPOSE 3000
CMD ["npx", "ts-node", "app.ts"]