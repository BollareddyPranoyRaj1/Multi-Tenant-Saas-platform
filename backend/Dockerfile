# Backend Dockerfile (optimized multi-stage)

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds

# Run as non-root
USER node

EXPOSE 5000

CMD ["node", "src/server.js"]
