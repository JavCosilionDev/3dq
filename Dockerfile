# Use Node.js v20 slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install Chromium for server-side PDF rendering
RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

# Copy all files (excluding .dockerignored files)
COPY . .

# Install dependencies and build
RUN npm install && \
    npm run client-install && \
    npm run build

# Set environment variables
ENV PORT=6123
ENV NODE_ENV=production
ENV CONFIG_DIR=/config
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create config directory
RUN mkdir -p /config

# Expose the port
EXPOSE 6123

# Start the application
CMD ["npm", "start"]
