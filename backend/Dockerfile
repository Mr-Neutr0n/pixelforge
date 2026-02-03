FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
