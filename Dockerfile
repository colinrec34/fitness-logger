# ── Frontend build stage ──────────────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage (Express server + built frontend) ───────────────────────────
FROM node:20-slim
WORKDIR /app/server

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server ./
RUN npx prisma generate

COPY --from=frontend-build /app/dist /app/dist

EXPOSE 3000
# Create/sync the schema, then start the server.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
