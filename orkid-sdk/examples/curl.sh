#!/usr/bin/env bash
# Example curl calls for the Orkid API.
# Set ORKID_API_KEY in your environment.

set -euo pipefail

API_KEY="${ORKID_API_KEY:?Set ORKID_API_KEY}"
BASE_URL="${ORKID_BASE_URL:-https://orkidlabs.xyz}"

echo "=== 1. Get quote ==="
curl -s -X POST "${BASE_URL}/api/v1/route" \
  -H "Content-Type: application/json" \
  -H "X-ORKID-API-Key: ${API_KEY}" \
  -d '{
    "from": "USDC",
    "to": "WETH",
    "amount": "25.0",
    "chain": "base",
    "fromAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "fromDecimals": 6,
    "toAddress": "0x4200000000000000000000000000000000000006",
    "toDecimals": 18
  }' | jq .

echo
echo "=== 2. Solve (dry-run) ==="
# Replace PERMIT and SIGNATURE with a real signed Permit2 message.
curl -s -X POST "${BASE_URL}/api/v1/solve" \
  -H "Content-Type: application/json" \
  -H "X-ORKID-API-Key: ${API_KEY}" \
  -d '{
    "from": "USDC",
    "to": "WETH",
    "amount": "25.0",
    "chain": "base",
    "user": "0x...",
    "fromAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "fromDecimals": 6,
    "toAddress": "0x4200000000000000000000000000000000000006",
    "toDecimals": 18,
    "dryRun": true,
    "slippageBps": 50,
    "permit": {
      "permitted": {
        "token": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "amount": "25000000"
      },
      "nonce": "123...",
      "deadline": "1725561600"
    },
    "signature": "0x..."
  }' | jq .
