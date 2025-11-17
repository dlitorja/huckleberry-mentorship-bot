# Dockerfile for Huckleberry Mentorship Bot
# Works on Fly.io, Railway, Render, and most other platforms

FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port for webhook server
EXPOSE 3000

# Start both bot and webhook server using production command
CMD ["npm", "run", "start:all:prod"]

