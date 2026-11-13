FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY attachments.mjs ./
RUN mkdir -p /data/private && chown node:node /data/private

ENV NODE_ENV=production
ENV PORT=8100
ENV SIGEP_PRIVATE_STORAGE_DIR=/data/private
EXPOSE 8100
VOLUME ["/data/private"]
USER node
CMD ["node", "server.mjs"]
