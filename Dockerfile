FROM node:18.7.0-slim AS base
# Install dependencies required for building Python
RUN apt-get update && apt-get install -y \
    ffmpeg tini libssl-dev ca-certificates git curl wget \
    build-essential libssl-dev zlib1g-dev \
    libncurses5-dev libncursesw5-dev libreadline-dev libsqlite3-dev \
    libgdbm-dev libdb5.3-dev libbz2-dev libexpat1-dev liblzma-dev \
    tk-dev libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js dependencies
FROM base AS dependencies
WORKDIR /usr/app
COPY package.json .
COPY yarn.lock .
RUN yarn install --prod

# Final stage
FROM base AS runner

WORKDIR /usr/app

# Install dependencies required for building Python
RUN apt-get update && apt-get install -y \
    ffmpeg tini libssl-dev ca-certificates git curl wget \
    build-essential libssl-dev zlib1g-dev \
    libncurses5-dev libncursesw5-dev libreadline-dev libsqlite3-dev \
    libgdbm-dev libdb5.3-dev libbz2-dev libexpat1-dev liblzma-dev \
    tk-dev libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Download and extract Python
ARG PYTHON_VERSION=3.12.1
RUN wget https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz && \
    tar -xvf Python-${PYTHON_VERSION}.tgz

# Build and install Python
WORKDIR Python-${PYTHON_VERSION}
RUN ./configure --enable-optimizations && \
    make -j 8 && \
    make altinstall

# Create a symbolic link for python command
RUN ln -s /usr/local/bin/python3.12 /usr/local/bin/python
RUN ln -s /usr/local/bin/python3.12 /usr/local/bin/python3

# Verify Python installation
RUN python --version && python3 --version

# Clean up
WORKDIR /
RUN rm -rf Python-${PYTHON_VERSION} Python-${PYTHON_VERSION}.tgz && \
    apt-get --purge remove -y build-essential libssl-dev zlib1g-dev \
    libncurses5-dev libncursesw5-dev libreadline-dev libsqlite3-dev \
    libgdbm-dev libdb5.3-dev libbz2-dev libexpat1-dev liblzma-dev \
    tk-dev libffi-dev && \
    apt-get autoremove -y && \
    apt-get clean

WORKDIR /usr/app
# Carry over necessary components from the dependencies stage
COPY --from=dependencies /usr/app/node_modules node_modules
COPY . .

# Install yt-dlp && ffmpeg
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp
RUN apt-get update && apt-get install -y ffmpeg
RUN apt-get clean

# Check if yt-dlp is executable and working
ENV PATH="/usr/local/bin:${PATH}"
RUN if [ ! -x /usr/local/bin/yt-dlp ]; then echo "yt-dlp not executable"; exit 1; fi
RUN yt-dlp --version


# Set environment variables
ARG COMMIT_HASH=unknown
ARG BUILD_DATE=unknown
ENV DATA_DIR=/data
ENV NODE_ENV=production
ENV COMMIT_HASH=$COMMIT_HASH
ENV BUILD_DATE=$BUILD_DATE

CMD ["tini", "--", "yarn", "start"]
