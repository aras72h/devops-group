# Stage 1: install dependencies
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Stage 2: runtime image
FROM node:20-alpine AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

# Create the agent data directory owned by appuser before switching users.
# The named volume mounts here at runtime — Docker preserves the ownership
# of the first container to write to a new volume.
RUN mkdir -p /agent-data && chown appuser:appgroup /agent-data

USER appuser

EXPOSE 3000

CMD ["node", "src/index.js"]
