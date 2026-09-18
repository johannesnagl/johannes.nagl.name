#!/usr/bin/env sh
# Push URLs to IndexNow (Bing, Yandex, and the engines that share the protocol).
#
# WHEN: a page appeared, disappeared, moved, or its WORDS changed. NOT every
# deploy. The engines rate-limit the HOST (429), and a ping for a CSS tweak, an
# interaction change or a Lighthouse fix asks them to re-crawl a page that reads
# exactly as it did — which teaches them this host's pings are noise. Most of
# this repository's commits should NOT run this script.
#
#   ./scripts/indexnow.sh /            # the homepage, after its words changed
#   ./scripts/indexnow.sh --all        # everything in the sitemap
#
# Paths are resolved against the host; full URLs on the host are fine too.
# 200 = submitted. 202 = accepted but the key is not validated yet, so submit
# once more in a few minutes. 403 = the key file could not be read. 422 = a URL
# is not on this host. 429 = too often, which is what --all is for avoiding.
set -eu

HOST="johannes.nagl.name"
KEY="fcec64544715f6fdc6b054e56539a89a"

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <path-or-url>... | --all" >&2
  exit 2
fi

if [ "$1" = "--all" ]; then
  URLS=$(curl -fsS "https://$HOST/sitemap.xml" | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g')
else
  # Built in THIS shell, not in a command substitution: a rejected argument has
  # to stop the run, and an `exit` inside $(...) only leaves the subshell,
  # which would submit the rest and report success.
  URLS=""
  for arg in "$@"; do
    case "$arg" in
      "https://$HOST/"*) url="$arg" ;;
      /*) url="https://$HOST$arg" ;;
      *)
        echo "not a path, or not a URL on $HOST: $arg" >&2
        exit 2
        ;;
    esac
    URLS="$URLS$url
"
  done
fi

STATUS_FILE=$(mktemp)
trap 'rm -f "$STATUS_FILE"' EXIT

echo "$URLS" | sed '/^[[:space:]]*$/d; s/^/  /' >&2
echo "$URLS" | HOST="$HOST" KEY="$KEY" python3 -c '
import json, os, sys
urls = [line.strip() for line in sys.stdin if line.strip()]
host, key = os.environ["HOST"], os.environ["KEY"]
print(json.dumps({
    "host": host,
    "key": key,
    "keyLocation": f"https://{host}/{key}.txt",
    "urlList": urls,
}))' | curl -s -o /dev/null -w '%{http_code}' -X POST https://api.indexnow.org/IndexNow \
  -H 'Content-Type: application/json; charset=utf-8' --data-binary @- > "$STATUS_FILE"

# `set -eu` gives false assurance here: curl without --fail exits 0 whatever the
# HTTP status, so the code is printed for a human and ignored by the shell. A 429
# looks exactly like a success to anything wrapping this, and the engines
# rate-limit the HOST rather than the URL, so a wasted ping spends the budget the
# next real content change needs.
STATUS=$(cat "$STATUS_FILE")
echo "$STATUS"
case "$STATUS" in
  200) exit 0 ;;
  202)
    echo "202: the key is not validated yet. Check https://$HOST/$KEY.txt is reachable, then submit again in a few minutes." >&2
    exit 0
    ;;
  429)
    echo "429: rate-limited. The limit is per host, not per URL, so wait rather than retrying now." >&2
    exit 1
    ;;
  *)
    echo "$STATUS: refused. 400 is a malformed body, 403 an invalid key, 422 a URL that does not belong to $HOST." >&2
    exit 1
    ;;
esac
