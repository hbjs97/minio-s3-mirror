# Build stage
FROM node:20-alpine AS builder
ENV TZ="Asia/Seoul"

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install --save-dev typescript @types/node && \
    npm run build

# ---

# Final stage - Alpine for mc compatibility
FROM node:20-alpine
ENV TZ="Asia/Seoul"
ENV NODE_ENV="production"

WORKDIR /app

# Install mc client and required dependencies
RUN apk add --no-cache \
    ca-certificates \
    wget \
    && rm -rf /var/cache/apk/*

# Download and install mc based on architecture
ARG TARGETARCH
RUN if [ "${TARGETARCH}" = "amd64" ]; then \
        wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc; \
    elif [ "${TARGETARCH}" = "arm64" ]; then \
        wget -q https://dl.min.io/client/mc/release/linux-arm64/mc -O /usr/local/bin/mc; \
    else \
        echo "unsupported architecture: ${TARGETARCH}"; exit 1; \
    fi && \
    chmod +x /usr/local/bin/mc

# Copy only production dependencies and built code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

# Use exec form for proper signal handling
ENTRYPOINT ["node", "dist/index.js"]
