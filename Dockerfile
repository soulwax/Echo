<<<<<<< HEAD
# Base image with Node.js
FROM node:18.7.0-slim AS base

# Install build dependencies for Python
RUN apt-get update && apt-get install -y \
    ffmpeg tini libssl-dev ca-certificates git curl wget \
    build-essential libssl-dev zlib1g-dev \
    libncurses5-dev libncursesw5-dev libreadline-dev libsqlite3-dev \
    libgdbm-dev libdb5.3-dev libbz2-dev libexpat1-dev liblzma-dev \
    tk-dev libffi-dev

# Download and extract Python
ARG PYTHON_VERSION=3.12.2
RUN wget https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz \
    && tar -xvf Python-${PYTHON_VERSION}.tgz

# Build and install Python
WORKDIR /Python-${PYTHON_VERSION}
RUN ./configure --enable-optimizations \
    && make -j 8 \
    && make altinstall

# Create symbolic links for python command
RUN ln -s /usr/local/bin/python3.12 /usr/local/bin/python \
    && ln -s /usr/local/bin/python3.12 /usr/local/bin/python3

# Verify Python installation
RUN python --version && python3 --version

# Clean up
WORKDIR /
RUN rm -rf Python-${PYTHON_VERSION} Python-${PYTHON_VERSION}.tgz \
    && apt-get --purge remove -y build-essential libssl-dev zlib1g-dev \
    libncurses5-dev libncursesw5-dev libreadline-dev libsqlite3-dev \
    libgdbm-dev libdb5.3-dev libbz2-dev libexpat1-dev liblzma-dev \
    tk-dev libffi-dev \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up the working directory for app
WORKDIR /usr/app

# Copying package files and installing Node.js dependencies
FROM base AS dependencies
COPY package.json yarn.lock ./
RUN yarn install --prod

# Final stage setup
FROM base AS runner

WORKDIR /usr/app

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Verify yt-dlp installation
RUN if [ ! -x /usr/local/bin/yt-dlp ]; then echo "yt-dlp not executable"; exit 1; fi
RUN yt-dlp --version

# Set environment variables
=======
FROM node:18-bullseye-slim AS base

# openssl will be a required package if base is updated to 18.16+ due to node:*-slim base distro change
# https://github.com/prisma/prisma/issues/19729#issuecomment-1591270599
# Install ffmpeg
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
    ffmpeg \
    tini \
    openssl \
    ca-certificates \
    && apt-get autoclean \
    && apt-get autoremove \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS dependencies

WORKDIR /usr/app

COPY package.json .
COPY yarn.lock .

RUN yarn install --prod
RUN cp -R node_modules /usr/app/prod_node_modules

RUN yarn install

FROM dependencies AS builder

COPY . .

# Install yt-dlp && ffmpeg
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp
RUN apt-get update && apt-get install -y ffmpeg
RUN apt-get clean

# Run tsc build
RUN yarn prisma generate
RUN yarn build

# Only keep what's necessary to run
FROM base AS runner

WORKDIR /usr/app

COPY --from=builder /usr/app/dist ./dist
COPY --from=dependencies /usr/app/prod_node_modules node_modules
COPY --from=builder /usr/app/node_modules/.prisma/client ./node_modules/.prisma/client

COPY . .

>>>>>>> staging
ARG COMMIT_HASH=unknown
ARG BUILD_DATE=unknown

<<<<<<< HEAD
# Expose the port the app runs on
EXPOSE 3071

# Carry over necessary components from the dependencies stage
COPY --from=dependencies /usr/app/node_modules node_modules
COPY . .

# Set the startup command
CMD ["tini", "--", "yarn", "start"]
=======
ENV DATA_DIR /data
ENV NODE_ENV production
ENV COMMIT_HASH $COMMIT_HASH
ENV BUILD_DATE $BUILD_DATE

CMD ["tini", "--", "node", "--enable-source-maps", "dist/scripts/migrate-and-start.js"]
>>>>>>> staging
