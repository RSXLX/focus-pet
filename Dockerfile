FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    FOCUS_PET_CHAT_HOST=0.0.0.0 \
    FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY src ./src

RUN mkdir -p /data/focus-pet-social

EXPOSE 47321
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const port=process.env.PORT||process.env.FOCUS_PET_CHAT_PORT||47321; fetch(`http://127.0.0.1:${port}/healthz`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "chat:serve"]
