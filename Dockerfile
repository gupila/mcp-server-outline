# Use Node.js LTS image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy TypeScript source
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Set Node environment to production
ENV NODE_ENV=production

# Change ownership to node user (already exists in base image)
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Run the server
CMD ["node", "dist/index.js"]
