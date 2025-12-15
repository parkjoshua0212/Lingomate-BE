#!/usr/bin/env bash
set -euo pipefail

echo "[predeploy] Installing ffmpeg (static)..."

ARCH="$(uname -m)"
TMP_DIR="$(mktemp -d)"

# Pick a static build URL by architecture
# (Most EB instances are x86_64. If you're on ARM (aarch64), use the arm64 one.)
if [[ "$ARCH" == "x86_64" ]]; then
  FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
elif [[ "$ARCH" == "aarch64" ]]; then
  FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
else
  echo "[predeploy] Unsupported architecture: $ARCH"
  exit 1
fi

echo "[predeploy] ARCH=$ARCH"
echo "[predeploy] Downloading: $FFMPEG_URL"

# Download + extract
curl -L "$FFMPEG_URL" -o "$TMP_DIR/ffmpeg.tar.xz"
tar -xf "$TMP_DIR/ffmpeg.tar.xz" -C "$TMP_DIR"

# Find extracted folder (starts with ffmpeg-...)
EXTRACT_DIR="$(find "$TMP_DIR" -maxdepth 1 -type d -name 'ffmpeg-*' | head -n 1)"
if [[ -z "${EXTRACT_DIR:-}" ]]; then
  echo "[predeploy] Could not find extracted ffmpeg folder"
  exit 1
fi

# Install binaries
sudo install -m 0755 "$EXTRACT_DIR/ffmpeg" /usr/local/bin/ffmpeg
sudo install -m 0755 "$EXTRACT_DIR/ffprobe" /usr/local/bin/ffprobe

echo "[predeploy] ffmpeg installed:"
/usr/local/bin/ffmpeg -version | head -n 2
