#!/bin/sh
# Writes /config.json from NOTIFY_API_URL at container start, so one image serves any notify host.
set -eu
target=/usr/share/nginx/html/config.json
url="${NOTIFY_API_URL:-}"
case "$url" in
  *'"'* | *'\'* ) echo "NOTIFY_API_URL must not contain quotes or backslashes" >&2; exit 1 ;;
esac
if [ -n "$url" ]; then
  printf '{ "apiUrl": "%s" }\n' "$url" > "$target"
else
  printf '{ "apiUrl": null }\n' > "$target"
fi
echo "notify-console: apiUrl=${url:-<unset: set it in Connect>}"
