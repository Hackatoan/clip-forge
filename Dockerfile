FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
EXPOSE 3001
ENV NODE_ENV=production
ENV DB_PATH=/data/features.db
ENV QUEUE_PATH=/data/pending_features.json
VOLUME ["/data"]
CMD ["node", "server/index.js"]
