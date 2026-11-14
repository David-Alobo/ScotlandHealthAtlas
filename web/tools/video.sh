#!/usr/bin/env bash
# Turn the frames from tools/video.mjs into an MP4 (H.264, 30 frames a second, 1920 x 1080). With a
# sound file, it plays quietly underneath: two copies joined with a three-second crossfade (so a
# short piece covers the video), levelled to -20 LUFS, faded in and out, cut to the video.
# Usage (in WSL or any shell with ffmpeg): bash tools/video.sh <out dir> <video file> [sound file]
set -euo pipefail
out="$1"
video="$(realpath -m "$2")"
sound="${3:+$(realpath "$3")}"
cd "$out"
if [ -z "$sound" ]; then
  ffmpeg -y -loglevel error -f concat -safe 0 -i frames.txt \
    -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -crf 22 -movflags +faststart "$video"
else
  length=$(awk '/^duration/ { s += $2 } END { printf "%.3f", s }' frames.txt)
  fade_out=$(awk -v l="$length" 'BEGIN { printf "%.3f", l - 4 }')
  ffmpeg -y -loglevel error -f concat -safe 0 -i frames.txt -i "$sound" -i "$sound" \
    -filter_complex "[0:v]fps=30,scale=1920:1080:flags=lanczos,format=yuv420p[v];\
[1:a][2:a]acrossfade=d=3,apad,atrim=0:${length},loudnorm=I=-20:TP=-2:LRA=11,\
afade=t=in:d=2,afade=t=out:st=${fade_out}:d=4,aresample=48000[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 160k \
    -t "$length" -movflags +faststart "$video"
fi
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$video"
