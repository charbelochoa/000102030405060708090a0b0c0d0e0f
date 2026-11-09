FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV HOST=0.0.0.0
ENV PORT=4318
ENV AERIS_AUTH_REQUIRED=true
ENV AERIS_DATA_DIR=/data
ENV AERIS_WORKSPACE=/workspace
COPY package*.json ./
COPY tools ./tools
RUN apt-get update && apt-get install -y --no-install-recommends git python3 python3-venv && rm -rf /var/lib/apt/lists/* && python3 -m venv /opt/analysis && /opt/analysis/bin/pip install --no-cache-dir -r tools/requirements.txt
ENV AERIS_PYTHON=/opt/analysis/bin/python
RUN npm ci --omit=dev && mkdir /data /workspace && chown node:node /data /workspace
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
COPY --from=build /app/skills ./skills
USER node
EXPOSE 4318
CMD ["node", "build/server/index.mjs"]
