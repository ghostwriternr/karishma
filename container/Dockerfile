# Karishma shared-computer image: computerd and common command-line tools.
#
# scripts/sync-warp-cert.sh stages an optional Cloudflare Zero Trust CA for
# build environments whose HTTPS traffic passes through Cloudflare WARP.
# computerd ships linux/amd64 only; Cloudflare Containers expect amd64.
FROM --platform=linux/amd64 ghcr.io/cloudflare/computer-computerd-linux-x64:0.2.1 AS computerd

FROM --platform=linux/amd64 debian:stable-slim

# Install CA tooling before commands that use HTTPS. The generated certificate
# file is empty in environments that use the standard public trust store.
COPY cloudflare_zero_trust.crt /tmp/cloudflare_zero_trust.crt
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && if [ -s /tmp/cloudflare_zero_trust.crt ]; then \
      cp /tmp/cloudflare_zero_trust.crt /usr/local/share/ca-certificates/cloudflare_zero_trust.crt; \
    fi \
 && update-ca-certificates \
 && apt-get install -y --no-install-recommends \
      fuse3 libfuse2t64 curl gnupg git \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

COPY --from=computerd /usr/local/bin/computerd /usr/local/bin/computerd

ENV PORT=8080
ENV MOUNT_POINT=/workspace
ENV FUSE_MOUNT=auto
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/computerd"]
