#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pulled from repo config/docs:
# - projectId in src/config/firebase.js
# - region in cloud/google-cloud-functions/README.md and configs
PROJECT_ID="${PROJECT_ID:-coffee-dial-app-9db38}"
LOCATION="${LOCATION:-us-central1}"
MODEL_ID="${MODEL_ID:-imagen-product-recontext-preview-06-30}"

IMAGE_PATH="${1:-$SCRIPT_DIR/test-image.jpg}"
PROMPT="${PROMPT:-Place this coffee bag on a pure solid black background (#000000). Keep the bag shape, label text, colors, and proportions unchanged. No extra objects, no props, no shadows, no texture, no gradient.}"

REQUEST_TEMPLATE="$SCRIPT_DIR/request.product-recontext.json.template"
REQUEST_JSON="$SCRIPT_DIR/request.product-recontext.json"
RESPONSE_JSON="$SCRIPT_DIR/response.product-recontext.json"
OUTPUT_IMAGE="$SCRIPT_DIR/output-product-recontext.png"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required but not found in PATH."
  exit 1
fi

if [[ ! -f "$IMAGE_PATH" ]]; then
  echo "Input image not found: $IMAGE_PATH"
  echo "Save your test image as:"
  echo "  $SCRIPT_DIR/test-image.jpg"
  echo "or pass a path:"
  echo "  $0 /path/to/coffee-bag.jpg"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for safe JSON templating/response parsing."
  exit 1
fi

B64_IMAGE="$(base64 < "$IMAGE_PATH" | tr -d '\n')"
if [[ -z "$B64_IMAGE" ]]; then
  echo "Failed to base64-encode image: $IMAGE_PATH"
  exit 1
fi

# Build request JSON safely with jq to avoid escaping issues in prompt text.
jq -n \
  --rawfile t "$REQUEST_TEMPLATE" \
  --arg b64 "$B64_IMAGE" \
  --arg prompt "$PROMPT" \
  '$t | gsub("__B64_BASE_IMAGE__"; $b64) | gsub("__TEXT_PROMPT__"; $prompt) | fromjson' \
  > "$REQUEST_JSON"

ACCESS_TOKEN="$(gcloud auth print-access-token)"

echo "Calling Vertex AI product recontext model..."
curl -sS \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @"$REQUEST_JSON" \
  "https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predict" \
  > "$RESPONSE_JSON"

RESULT_B64="$(jq -r '.predictions[0].bytesBase64Encoded // empty' "$RESPONSE_JSON")"
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
