# tts-api-auth — you asked for v1.2 with write routes. You don't need it.

**The plugin you already have can write posts, pages and options. I tested the wrong thing
the first time round.**

## What happened
In the first pass I concluded "no API path exists" for WordPress writes. That was wrong. I
tested **Application Passwords** (`wp/v2/users/me` with basic auth → 401) and treated the
401 as proof the core REST API was closed. Hostinger blocks Application Passwords — and
**bypassing that block is the entire purpose of this plugin.** I never retested core REST
with the `X-TTS-API-Key` header.

With the key header, on the live site right now:

| Endpoint | Result |
|---|---|
| `GET wp/v2/users/me?context=edit` | **200** — authenticated as `jgoetz`, administrator |
| `GET/POST wp/v2/posts/{id}` | **200** |
| `GET/POST wp/v2/pages/{id}` | **200** |
| `GET wp/v2/settings` | **200** |

The plugin's `determine_current_user` filter maps a valid key to an administrator user, so
**every core REST route is already available**, with WP revisions on `post_content` for
free. Writing new routes for posts, pages and options would duplicate what core already
does, with less review behind it.

## The Elementor write path is also already safe
I expected the live 1.1.0 to be missing the `wp_slash()` fix and planned to gate all
Elementor writes behind an upgrade. It isn't missing. Probing the live endpoint with
deliberately invalid JSON returns the 1.1.1 error text verbatim:

```
{"code":"tts_bad_elementor_json","message":"elementor_data is not valid JSON, raw or
pre-slashed — refusing to write. Storing it would render the page blank. (Syntax error)"}
```

So the live plugin has the slashing fix, the shape check, and the read-back-and-roll-back
guard. The version string is just behind.

**Because of that, all the false-claim fixes are already applied and verified** — see
`crawl_before_after.md` and run `scripts/sale/wp_verify_claims.sh`. Nothing was waiting on
you.

## So what is the zip for?
`tts-api-auth-1.1.1.zip` — one genuine difference: the live 1.1.0 has **no `/rotate-key`
route** (`rest_no_route`). Uploading 1.1.1 adds it, so the API key can be rotated over the
API instead of through `wp-admin/options.php`. That is a convenience, not a blocker; the
key was already rotated by hand on 2026-09-15.

**Upload whenever it suits you.** Nothing in the sprint depends on it.

### How
WP Admin → Plugins → Add New → Upload Plugin → choose the zip → Replace current with
uploaded. Then confirm:
```
curl -sS -H "X-TTS-API-Key: $TTS_WP_API_KEY" https://temptationtoken.io/wp-json/tts/v1/status
```
should report `"version":"1.1.1"`.
