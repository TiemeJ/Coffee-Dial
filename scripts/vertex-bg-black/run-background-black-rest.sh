#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pulled from repo config/docs:
# - projectId in src/config/firebase.js
# - functions region in cloud/google-cloud-functions/README.md and configs
PROJECT_ID="${PROJECT_ID:-coffee-dial-app-9db38}"
LOCATION="${LOCATION:-us-central1}"

MODEL_ID="${MODEL_ID:-imagen-3.0-capability-001}"
IMAGE_PATH="${1:-$SCRIPT_DIR/test-image.jpg}"
REQUEST_TEMPLATE="$SCRIPT_DIR/request.json.template"
REQUEST_JSON="$SCRIPT_DIR/request.json"
RESPONSE_JSON="$SCRIPT_DIR/response.json"
OUTPUT_IMAGE="$SCRIPT_DIR/output-black-bg.png"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required but not found in PATH."
  exit 1
fi

if [[ ! -f "$IMAGE_PATH" ]]; then
  echo "Input image not found: $IMAGE_PATH"
  echo "Save your attached test image as:"
  echo "  $SCRIPT_DIR/test-image.jpg"
  echo "or pass a path:"
  echo "  $0 /path/to/coffee-bag.jpg"
  exit 1
fi

B64_IMAGE="$(base64 < "$IMAGE_PATH" | tr -d '\n')"
if [[ -z "$B64_IMAGE" ]]; then
  echo "Failed to base64-encode image: $IMAGE_PATH"
  exit 1
fi

sed "s|__B64_BASE_IMAGE__|$B64_IMAGE|g" "$REQUEST_TEMPLATE" > "$REQUEST_JSON"

ACCESS_TOKEN="$(gcloud auth print-access-token)"

echo "Calling Vertex AI image background replace..."
curl -sS \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @"$REQUEST_JSON" \
  "https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predict" \
  > "$RESPONSE_JSON"

if ! command -v jq >/dev/null 2>&1; then
  echo "Request completed. jq not found, so skipping decode."
  echo "Response saved at: $RESPONSE_JSON"
  exit 0
fi

RESULT_B64="$(jq -r '.predictions[0].bytesBase64Encoded // empty' "$RESPONSE_JSON")"
if [[ -z "$RESULT_B64" ]]; then
  echo "No image bytes returned. Inspect: $RESPONSE_JSON"
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
