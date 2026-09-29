# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only the manifest first so Docker can cache this layer.
# The layer is only rebuilt when package.json changes.
COPY package.json ./

RUN npm install --omit=dev

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Bring in production node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY package.json ./

USER appuser

EXPOSE 3000

# Tini as PID 1 handles signals properly so `docker stop` is fast
# (alpine includes it via --init flag in compose; no extra install needed)
CMD ["node", "src/index.js"]
