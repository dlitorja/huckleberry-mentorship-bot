# Dockerfile for Huckleberry Mentorship Bot
# Works on Fly.io, Railway, Render, and most other platforms

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port for webhook server
EXPOSE 3000

# Start both bot and webhook server
CMD ["npm", "run", "start:all"]

