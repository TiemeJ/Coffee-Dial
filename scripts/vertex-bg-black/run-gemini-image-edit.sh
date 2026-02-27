#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

API_KEY="${GEMINI_API_KEY:-}"
MODEL_ID="${MODEL_ID:-gemini-2.5-flash-image-preview}"
IMAGE_PATH="${1:-$SCRIPT_DIR/test-image.jpg}"
PROMPT="${PROMPT:-Keep the coffee bag unchanged in shape, label, text, and colors. Remove the background and make it fully transparent (alpha channel), like a transparent PNG.}"

REQUEST_TEMPLATE="$SCRIPT_DIR/request.gemini-image-edit.json.template"
REQUEST_JSON="$SCRIPT_DIR/request.gemini-image-edit.json"
RESPONSE_JSON="$SCRIPT_DIR/response.gemini-image-edit.json"
OUTPUT_IMAGE="$SCRIPT_DIR/output-gemini-image-edit.png"

if [[ -z "$API_KEY" ]]; then
  echo "Missing GEMINI_API_KEY environment variable."
  echo "Example:"
  echo "  GEMINI_API_KEY=... $0"
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

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for JSON templating/parsing."
  exit 1
fi

MIME_TYPE="image/jpeg"
case "${IMAGE_PATH##*.}" in
  png|PNG) MIME_TYPE="image/png" ;;
  webp|WEBP) MIME_TYPE="image/webp" ;;
  jpg|JPG|jpeg|JPEG) MIME_TYPE="image/jpeg" ;;
esac

B64_IMAGE="$(base64 < "$IMAGE_PATH" | tr -d '\n')"
if [[ -z "$B64_IMAGE" ]]; then
  echo "Failed to base64-encode image: $IMAGE_PATH"
  exit 1
fi

jq -n \
  --rawfile t "$REQUEST_TEMPLATE" \
  --arg b64 "$B64_IMAGE" \
  --arg prompt "$PROMPT" \
  --arg mime "$MIME_TYPE" \
  '$t
   | gsub("__B64_BASE_IMAGE__"; $b64)
   | gsub("__TEXT_PROMPT__"; $prompt)
   | gsub("__MIME_TYPE__"; $mime)
   | fromjson' \
  > "$REQUEST_JSON"

echo "Calling Gemini image edit model..."
curl -sS \
  -X POST \
  -H "Content-Type: application/json" \
  -d @"$REQUEST_JSON" \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}" \
  > "$RESPONSE_JSON"

RESULT_B64="$(
  jq -r '
    .candidates[]?.content?.parts[]?
    | (.inline_data?.data // .inlineData?.data // empty)
  ' "$RESPONSE_JSON" | head -n1
)"

if [[ -z "$RESULT_B64" ]]; then
  echo "No image bytes returned."
  jq -r '.error // "No structured error payload"' "$RESPONSE_JSON" || true
  echo "Inspect: $RESPONSE_JSON"
  exit 1
fi

if base64 --help >/dev/null 2>&1; then
  echo "$RESULT_B64" | base64 --decode > "$OUTPUT_IMAGE" 2>/dev/null || echo "$RESULT_B64" | base64 -D > "$OUTPUT_IMAGE"
else
  echo "$RESULT_B64" | base64 -D > "$OUTPUT_IMAGE"
fi

echo "Done."
echo "Request:  $REQUEST_JSON"
echo "Response: $RESPONSE_JSON"
echo "Output:   $OUTPUT_IMAGE"
