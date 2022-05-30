#!/bin/sh
set -e

tmp=$(mktemp)
configfile='/usr/share/nginx/html/config/config.json'

if [[ -z "${BASE_URL}" ]]; then
  :
else
  jq --arg baseUrl "$BASE_URL" '.baseUrl = $baseUrl' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi

if [[ -z "${POLICY_0}" ]]; then
  :
else
  jq --arg name "$POLICY_0" '.policies[0].name = $name' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi

if [[ -z "${POLICY_1}" ]]; then
  :
else
  jq --arg name "$POLICY_1" '.policies[1].name = $name' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi

if [[ -z "${POLICY_2}" ]]; then
  :
else
  jq --arg name "$POLICY_2" '.policies[2].name = $name' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi

if [[ -z "${TOKEN_0}" ]]; then
  :
else
  jq --arg token "$TOKEN_0" '.policies[0].token = $token' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi

if [[ -z "${TOKEN_1}" ]]; then
  :
else
  jq --arg token "$TOKEN_1" '.policies[1].token = $token' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi

if [[ -z "${TOKEN_2}" ]]; then
  :
else
  jq --arg token "$TOKEN_2" '.policies[2].token = $token' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi


chmod a+r $configfile

# Run cmd
exec "$@"