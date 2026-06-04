FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=optional
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional
COPY --from=builder /app/dist ./dist
COPY server ./server
RUN mkdir -p /data
EXPOSE 3001
ENV NODE_ENV=production
ENV DATA_FILE=/data/features.json
VOLUME ["/data"]
CMD ["node", "server/index.js"]
