#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-my-dev-key}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

run_case() {
  local name="$1"
  shift
  local body_file="$tmp_dir/${name}.body"
  local code

  code="$(curl -sS -o "$body_file" -w "%{http_code}" "$@")"
  echo "[$name] status=$code body=$(cat "$body_file")"
}

echo "Validating /api/convert error responses at $BASE_URL"

run_case "missing_api_key" \
  -X POST "$BASE_URL/api/convert" \
  -H "Content-Type: application/json" \
  --data '{"html":"<h1>missing key</h1>"}'

run_case "invalid_input_html_and_url" \
  -X POST "$BASE_URL/api/convert" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"html":"<h1>both</h1>","url":"https://example.com"}'

run_case "invalid_api_key" \
  -X POST "$BASE_URL/api/convert" \
  -H "X-API-KEY: definitely-not-a-real-key" \
  -H "Content-Type: application/json" \
  --data '{"html":"<h1>invalid key</h1>"}'

run_case "blocked_url_localhost" \
  -X POST "$BASE_URL/api/convert" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"url":"http://127.0.0.1"}'

run_case "timeout" \
  -X POST "$BASE_URL/api/convert" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"url":"https://example.com","timeout":1}'
