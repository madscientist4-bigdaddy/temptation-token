#!/bin/bash
# Re-run the crawler user-agent matrix. Read-only; safe to run any time.
UAS=("Googlebot/2.1 (+http://www.google.com/bot.html)|Googlebot"
"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)|Bingbot"
"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot|GPTBot"
"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot|OAI-SearchBot"
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36; compatible; ChatGPT-User/1.0|ChatGPT-User"
"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com|ClaudeBot"
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15; compatible; Claude-User/1.0|Claude-User"
"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0|PerplexityBot"
"Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)|Applebot"
"DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)|DuckDuckBot"
"CCBot/2.0 (https://commoncrawl.org/faq/)|CCBot")
fail=0
for host in https://temptationtoken.io https://app.temptationtoken.io; do
  echo "=== $host ==="
  for e in "${UAS[@]}"; do
    ua="${e%%|*}"; n="${e##*|}"
    c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -A "$ua" "$host/")
    printf "  %-16s %s\n" "$n" "$c"
    [ "$c" = "200" ] || fail=1
  done
done
echo; [ $fail -eq 0 ] && echo "ALL 200" || { echo "SOME NON-200 — investigate"; exit 1; }
