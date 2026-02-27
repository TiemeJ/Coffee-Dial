#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

API_KEY="${REMOVE_BG_API_KEY:-}"
IMAGE_PATH="${1:-$SCRIPT_DIR/test-image.jpg}"
SIZE="${SIZE:-auto}" # auto | preview | full | 4k
TYPE="${TYPE:-auto}" # auto | person | product | car
FORMAT="${FORMAT:-png}" # png | jpg | webp

OUTPUT_IMAGE="$SCRIPT_DIR/output-removebg.${FORMAT}"
RESPONSE_JSON="$SCRIPT_DIR/response.removebg.json"

if [[ -z "$API_KEY" ]]; then
  echo "Missing REMOVE_BG_API_KEY environment variable."
  echo "Example:"
  echo "  REMOVE_BG_API_KEY=... $0"
  exit 1
fi

if [[ ! -f "$IMAGE_PATH" ]]; then
  echo "Input image not found: $IMAGE_PATH"
  echo "Save test image as:"
  echo "  $SCRIPT_DIR/test-image.jpg"
  echo "or pass a path:"
  echo "  $0 /path/to/coffee-bag.jpg"
  exit 1
fi

echo "Calling remove.bg..."
HTTP_CODE="$(
  curl -sS \
    -w "%{http_code}" \
    -o "$OUTPUT_IMAGE" \
    -X POST "https://api.remove.bg/v1.0/removebg" \
    -H "X-Api-Key: ${API_KEY}" \
    -F "image_file=@${IMAGE_PATH}" \
    -F "size=${SIZE}" \
    -F "type=${TYPE}" \
    -F "format=${FORMAT}" \
    -F "bg_color=00000000"
)"

if [[ "$HTTP_CODE" != "200" ]]; then
  # If failed, try to capture JSON/text error body for easier debugging.
  rm -f "$OUTPUT_IMAGE"
  curl -sS \
    -X POST "https://api.remove.bg/v1.0/removebg" \
    -H "X-Api-Key: ${API_KEY}" \
    -F "image_file=@${IMAGE_PATH}" \
    -F "size=${SIZE}" \
    -F "type=${TYPE}" \
    -F "format=${FORMAT}" \
    -F "bg_color=00000000" \
    > "$RESPONSE_JSON" || true
  echo "remove.bg request failed (HTTP ${HTTP_CODE})."
  echo "Error response: $RESPONSE_JSON"
  exit 1
fi

echo "Done."
echo "Output: $OUTPUT_IMAGE"

