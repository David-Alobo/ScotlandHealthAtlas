#!/usr/bin/env bash
# Turn the frames from tools/video.mjs into an MP4 (H.264, 30 frames a second, 1920 x 1080).
# Usage (in WSL or any shell with ffmpeg): bash tools/video.sh <out dir> <video file>
set -euo pipefail
out="$1"
video="$(realpath -m "$2")"
cd "$out"
ffmpeg -y -loglevel error -f concat -safe 0 -i frames.txt \
  -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 22 -movflags +faststart "$video"
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$video"
