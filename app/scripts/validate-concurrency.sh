#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-my-dev-key}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-6}"
DELAY_MS="${DELAY_MS:-7000}"

if ! [[ "$TOTAL_REQUESTS" =~ ^[0-9]+$ ]] || [ "$TOTAL_REQUESTS" -lt 1 ]; then
  echo "TOTAL_REQUESTS must be a positive integer" >&2
  exit 1
fi

if ! [[ "$DELAY_MS" =~ ^[0-9]+$ ]] || [ "$DELAY_MS" -lt 0 ]; then
  echo "DELAY_MS must be a non-negative integer" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

echo "Running $TOTAL_REQUESTS overlapping requests against $BASE_URL/api/convert (delayMs=$DELAY_MS)"

for i in $(seq 1 "$TOTAL_REQUESTS"); do
  (
    payload=$(cat <<EOF
{"html":"<html><body><h1>Concurrency Validation</h1><p>Request $i</p></body></html>","delayMs":$DELAY_MS}
EOF
)
    curl -sS -o "$tmp_dir/body-$i.bin" -w "%{http_code}\n" \
      -X POST "$BASE_URL/api/convert" \
      -H "X-API-KEY: $API_KEY" \
      -H "Content-Type: application/json" \
      --data "$payload" \
      > "$tmp_dir/status-$i.txt" || echo "000" > "$tmp_dir/status-$i.txt"
  ) &
done

wait

ok_count=0
too_many_count=0
other_count=0

for i in $(seq 1 "$TOTAL_REQUESTS"); do
  code="$(tr -d '\n' < "$tmp_dir/status-$i.txt")"
  printf "request %02d -> %s\n" "$i" "$code"
  case "$code" in
    200) ok_count=$((ok_count + 1)) ;;
    429) too_many_count=$((too_many_count + 1)) ;;
    *) other_count=$((other_count + 1)) ;;
  esac
done

echo "Summary: 200=$ok_count 429=$too_many_count other=$other_count total=$TOTAL_REQUESTS"
echo "Server logs should show matching start/finish pairs and end at active=0/<limit>."
