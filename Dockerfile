FROM node:18.7.0-slim AS base

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg tini libssl-dev ca-certificates git curl python && \
    rm -rf /var/lib/apt/lists/* && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

RUN if [ ! -x /usr/local/bin/yt-dlp ]; then echo "yt-dlp not executable"; exit 1; fi

# Install dependencies
FROM base AS dependencies

WORKDIR /usr/app

COPY package.json .
COPY yarn.lock .

RUN yarn install --prod

# Only keep what's necessary to run
FROM base AS runner

WORKDIR /usr/app

COPY --from=dependencies /usr/app/node_modules node_modules

COPY . .

RUN yarn prisma generate

ARG COMMIT_HASH=unknown
ARG BUILD_DATE=unknown

ENV DATA_DIR /data
ENV NODE_ENV production
ENV COMMIT_HASH $COMMIT_HASH
ENV BUILD_DATE $BUILD_DATE
ENV PATH="/usr/local/bin:${PATH}"
RUN yt-dlp --version

CMD ["tini", "--", "yarn", "start"]
