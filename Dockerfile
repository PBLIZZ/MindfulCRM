# Dockerfile

# Stage 1: Base dependencies for production
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Builder for compiling the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
# Install all dependencies to build
RUN npm ci
# Build the frontend and backend
RUN npm run build:client && npm run build:server

# Stage 3: Final runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
# Copy production node_modules from 'base' stage
COPY --from=base /app/node_modules ./node_modules
# Copy compiled code from 'builder' stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
# If you have migrations, copy them too
# COPY --from=builder /app/migrations ./migrations

# Run as a non-root user for security
USER node
EXPOSE 3000
# The command to start the application
CMD ["node", "dist/server/index.js"] 