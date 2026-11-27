FROM node:22-alpine

WORKDIR /app
# Normalize modes even when the checkout was created with a restrictive umask.
COPY --chmod=0644 package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chmod=0644 server.mjs ./
COPY --chmod=0644 attachments.mjs permissions.mjs users.mjs initial-reception.mjs check-installation.mjs ./
RUN mkdir -p /data/private && chown node:node /data/private

ENV NODE_ENV=production
ENV PORT=8100
ENV SIGEP_PRIVATE_STORAGE_DIR=/data/private
EXPOSE 8100
VOLUME ["/data/private"]
USER node
# Fail the build if the runtime user cannot read the entry point or its modules.
RUN node --input-type=module -e \
  "import { readFileSync } from 'node:fs'; readFileSync('server.mjs'); await Promise.all([import('pg'), import('./initial-reception.mjs'), import('./users.mjs')]);"
CMD ["node", "server.mjs"]
