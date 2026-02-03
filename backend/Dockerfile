FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDeps for tsc)
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove devDependencies for smaller image
RUN npm prune --production

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
