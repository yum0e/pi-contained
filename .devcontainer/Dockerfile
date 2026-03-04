FROM node:24.14.0-bookworm-slim

ARG TZ=UTC
ENV TZ="$TZ"

ARG PI_VERSION=latest
ARG JJ_VERSION=0.39.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    less \
    openssh-client \
    procps \
    ripgrep \
    fd-find \
  && rm -rf /var/lib/apt/lists/*

RUN if command -v fdfind >/dev/null 2>&1 && [ ! -e /usr/local/bin/fd ]; then \
      ln -s /usr/bin/fdfind /usr/local/bin/fd; \
    fi

RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) jj_target="x86_64-unknown-linux-musl" ;; \
      arm64) jj_target="aarch64-unknown-linux-musl" ;; \
      *) echo "Unsupported architecture for jj: $arch" >&2; exit 1 ;; \
    esac; \
    jj_tar="jj-v${JJ_VERSION}-${jj_target}.tar.gz"; \
    curl -fsSL "https://github.com/jj-vcs/jj/releases/download/v${JJ_VERSION}/${jj_tar}" -o /tmp/jj.tar.gz; \
    rm -rf /tmp/jj-extract && mkdir -p /tmp/jj-extract; \
    tar -xzf /tmp/jj.tar.gz -C /tmp/jj-extract; \
    jj_bin="$(find /tmp/jj-extract -type f -name jj -print -quit)"; \
    [ -n "$jj_bin" ]; \
    install -m 0755 "$jj_bin" /usr/local/bin/jj; \
    rm -rf /tmp/jj.tar.gz /tmp/jj-extract; \
    jj --version

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN npm install -g "@mariozechner/pi-coding-agent@${PI_VERSION}"

ENV DEVCONTAINER=true
ENV HOME=/home/node
ENV PI_CODING_AGENT_DIR=/home/node/.pi/agent

RUN mkdir -p /workspace /home/node/.pi && chown -R node:node /workspace /home/node/.pi

WORKDIR /workspace
USER node
