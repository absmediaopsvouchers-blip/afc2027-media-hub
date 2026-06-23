# =============================================================================
#  AFC 2027 Media Hub — container image (works on Fly.io, Railway, Cloud Run,
#  Render Docker, any container host).
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching). Includes optionalDependencies
# (pg, mongoose) so the cloud database adapters are available.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# App source.
COPY . .

# The host overrides PORT at runtime; 3000 is just the local default.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
