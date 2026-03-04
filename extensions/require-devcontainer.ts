import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const DEVCONTAINER_JSON_TEMPLATE = `{
  "name": "pi-devcontainer",
  "init": true,
  "build": {
    "dockerfile": "Dockerfile",
    "args": {
      "TZ": "\${localEnv:TZ:UTC}",
      "PI_VERSION": "latest",
      "JJ_VERSION": "0.39.0"
    }
  },
  "remoteUser": "node",
  "workspaceMount": "source=\${localWorkspaceFolder},target=/workspace,type=bind,consistency=delegated",
  "workspaceFolder": "/workspace",
  "mounts": [
    "source=\${localEnv:HOME}/.pi,target=/home/node/.pi,type=bind,consistency=cached"
  ],
  "runArgs": [
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges:true"
  ],
  "containerEnv": {
    "DEVCONTAINER": "true",
    "PI_CODING_AGENT_DIR": "/home/node/.pi/agent"
  },
  "customizations": {
    "vscode": {
      "settings": {
        "terminal.integrated.defaultProfile.linux": "bash"
      }
    }
  }
}
`;

const DOCKERFILE_TEMPLATE = `FROM node:24.14.0-bookworm-slim

ARG TZ=UTC
ENV TZ="$TZ"

ARG PI_VERSION=latest
ARG JJ_VERSION=0.39.0

RUN apt-get update && apt-get install -y --no-install-recommends \\
    bash \\
    ca-certificates \\
    curl \\
    git \\
    less \\
    openssh-client \\
    procps \\
    ripgrep \\
    fd-find \\
  && rm -rf /var/lib/apt/lists/*

RUN if command -v fdfind >/dev/null 2>&1 && [ ! -e /usr/local/bin/fd ]; then \\
      ln -s /usr/bin/fdfind /usr/local/bin/fd; \\
    fi

RUN set -eux; \\
    arch="$(dpkg --print-architecture)"; \\
    case "$arch" in \\
      amd64) jj_target="x86_64-unknown-linux-musl" ;; \\
      arm64) jj_target="aarch64-unknown-linux-musl" ;; \\
      *) echo "Unsupported architecture for jj: $arch" >&2; exit 1 ;; \\
    esac; \\
    jj_tar="jj-v\${JJ_VERSION}-\${jj_target}.tar.gz"; \\
    curl -fsSL "https://github.com/jj-vcs/jj/releases/download/v\${JJ_VERSION}/\${jj_tar}" -o /tmp/jj.tar.gz; \\
    rm -rf /tmp/jj-extract && mkdir -p /tmp/jj-extract; \\
    tar -xzf /tmp/jj.tar.gz -C /tmp/jj-extract; \\
    jj_bin="$(find /tmp/jj-extract -type f -name jj -print -quit)"; \\
    [ -n "$jj_bin" ]; \\
    install -m 0755 "$jj_bin" /usr/local/bin/jj; \\
    rm -rf /tmp/jj.tar.gz /tmp/jj-extract; \\
    jj --version

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN npm install -g "@mariozechner/pi-coding-agent@\${PI_VERSION}"

ENV DEVCONTAINER=true
ENV HOME=/home/node
ENV PI_CODING_AGENT_DIR=/home/node/.pi/agent

RUN mkdir -p /workspace /home/node/.pi && chown -R node:node /workspace /home/node/.pi

WORKDIR /workspace
USER node
`;

const REPO_EXTENSION_TEMPLATE = `import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function inContainer(): boolean {
  return process.env.DEVCONTAINER === "true" || existsSync("/.dockerenv");
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!inContainer()) {
      ctx.ui.notify(
        "This setup is fail-closed: run pi through the devcontainer wrapper (pi-devcontainer / aliased pi).",
        "error",
      );
      ctx.shutdown();
      return;
    }

    ctx.ui.setStatus("pi-devcontainer", ctx.ui.theme.fg("accent", "devcontainer: active"));
  });
}
`;

const MARKER_START = "# >>> pi-devcontainer >>>";
const MARKER_END = "# <<< pi-devcontainer <<<";

function inContainer(): boolean {
  return process.env.DEVCONTAINER === "true" || existsSync("/.dockerenv");
}

function ensureFile(filePath: string, content: string): boolean {
  if (existsSync(filePath)) return false;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return true;
}

function bootstrapWorkspace(cwd: string): string[] {
  const created: string[] = [];

  if (ensureFile(join(cwd, ".devcontainer", "devcontainer.json"), DEVCONTAINER_JSON_TEMPLATE)) {
    created.push(".devcontainer/devcontainer.json");
  }

  if (ensureFile(join(cwd, ".devcontainer", "Dockerfile"), DOCKERFILE_TEMPLATE)) {
    created.push(".devcontainer/Dockerfile");
  }

  if (ensureFile(join(cwd, ".pi", "extensions", "require-devcontainer.ts"), REPO_EXTENSION_TEMPLATE)) {
    created.push(".pi/extensions/require-devcontainer.ts");
  }

  return created;
}

function shellRcFile(): string {
  const shell = process.env.SHELL ?? "";
  if (shell.includes("zsh")) return join(homedir(), ".zshrc");
  return join(homedir(), ".bashrc");
}

function findAliasTarget(): string {
  if (process.env.PI_DEVCONTAINER_ALIAS_TARGET) {
    return process.env.PI_DEVCONTAINER_ALIAS_TARGET;
  }

  try {
    const resolved = execSync("command -v pi-devcontainer", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: "/bin/bash",
    })
      .trim()
      .split("\n")
      .find((line) => line.length > 0);

    if (resolved) return resolved;
  } catch {
    // fall through
  }

  return "npx -y pi-devcontainer-extension@latest run";
}

function escapeForSingleQuotes(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureAlias(): { rcFile: string; aliasTarget: string; changed: boolean } | null {
  if (process.env.PI_DEVCONTAINER_SKIP_ALIAS === "1") return null;

  const rcFile = shellRcFile();
  const aliasTarget = findAliasTarget();
  const aliasLine = `alias pi='${escapeForSingleQuotes(aliasTarget)}'`;
  const block = `${MARKER_START}\n${aliasLine}\n${MARKER_END}\n`;

  const existing = existsSync(rcFile) ? readFileSync(rcFile, "utf8") : "";
  const blockRegex = new RegExp(`${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}\\n?`, "g");
  const stripped = existing.replace(blockRegex, "").replace(/\n*$/, "");
  const next = `${stripped.length > 0 ? `${stripped}\n` : ""}${block}`;

  const changed = next !== existing;
  if (changed) {
    mkdirSync(dirname(rcFile), { recursive: true });
    writeFileSync(rcFile, next, "utf8");
  }

  return { rcFile, aliasTarget, changed };
}

export default function (pi: ExtensionAPI) {
  let blockHostInput = false;
  let hostRerunHint = "pi-devcontainer";

  pi.on("session_start", async (_event, ctx) => {
    if (inContainer()) {
      ctx.ui.setStatus("pi-devcontainer", ctx.ui.theme.fg("accent", "devcontainer: active"));
      return;
    }

    blockHostInput = true;

    const autoBootstrap = process.env.PI_DEVCONTAINER_AUTO_BOOTSTRAP !== "0";

    if (autoBootstrap) {
      const created = bootstrapWorkspace(ctx.cwd);
      const alias = ensureAlias();
      const changedAlias = Boolean(alias?.changed);
      hostRerunHint = alias ? `source ${alias.rcFile} && pi` : "pi-devcontainer";

      if (created.length > 0 || changedAlias) {
        process.stdout.write(
          `[pi-devcontainer-bootstrap] ${JSON.stringify({ cwd: ctx.cwd, created, alias, rerunHint: hostRerunHint })}\n`,
        );

        ctx.ui.notify("Bootstrapped devcontainer files for this repo.", "info");
        if (alias?.changed) {
          ctx.ui.notify(`Alias installed in ${alias.rcFile}. Run: source ${alias.rcFile}`, "info");
        }
        ctx.ui.notify(`Re-run pi with: ${hostRerunHint}`, "warning");
        ctx.shutdown();
        return;
      }
    }

    ctx.ui.notify(
      "This setup is fail-closed: run pi through the devcontainer wrapper (pi-devcontainer / aliased pi).",
      "error",
    );
    ctx.ui.notify(`Run: ${hostRerunHint}`, "warning");
    ctx.shutdown();
  });

  pi.on("input", async () => {
    if (!blockHostInput) {
      return { action: "continue" as const };
    }

    return { action: "handled" as const };
  });
}
