#!/usr/bin/env bash
# Stitch the recorded scenes into one 1080p MP4 under 2 minutes.
#   scripts/demo-assemble.sh <segmentsDir> <out.mp4>
set -euo pipefail
D="$1"; OUT="$2"; MAX=118
cd "$D"
rm -f part_*.mp4 list.txt
i=0
python3 -c 'import json;[print(s["file"], s["speed"]) for s in json.load(open("segments.json"))]' | while read -r f speed; do
  i=$((i+1)); o=$(printf "part_%02d.mp4" "$i")
  # pass 1: speed + 1080p + 30 fps (also gives the clip a real duration; raw screencasts have none)
  ffmpeg -nostdin -v error -y -i "$f" -vf "setpts=PTS/$speed,scale=1920:1080:flags=lanczos,fps=30,format=yuv420p" -an -c:v libx264 -preset veryfast -crf 16 "tmp_$o"
  sdur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "tmp_$o")
  fo=$(python3 -c "print(max(0.0, float('$sdur') - 0.25))")
  # pass 2: short fade in and out so every cut feels edited
  ffmpeg -nostdin -v error -y -i "tmp_$o" -vf "fade=t=in:st=0:d=0.25,fade=t=out:st=$fo:d=0.25,format=yuv420p" -an -c:v libx264 -preset veryfast -crf 18 "$o"
  rm -f "tmp_$o"
  echo "file '$o'" >> list.txt
done
ffmpeg -nostdin -v error -y -f concat -safe 0 -i list.txt -c copy joined.mp4
total=$(ffprobe -v error -show_entries format=duration -of csv=p=0 joined.mp4)
speed=$(python3 -c "t=float('$total'); print(round(max(1.0, t/$MAX), 4))")
echo "joined: ${total}s -> global speed x$speed"
ffmpeg -nostdin -v error -y -i joined.mp4 -vf "setpts=PTS/$speed,format=yuv420p" -an -c:v libx264 -preset medium -crf 20 -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
