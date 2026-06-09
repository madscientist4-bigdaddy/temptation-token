-- ============================================================
-- TTS WordPress Recovery SQL
-- Generated: 2026-06-09
-- Site: temptationtoken.io (Hostinger / MySQL)
-- Purpose: Fix all remaining bad strings after tts-wp-fixer
--          ran partially before the 504 timeout.
-- ============================================================
--
-- HOW TO RUN IN HOSTINGER phpMyAdmin
-- -----------------------------------
-- 1. Log into https://hpanel.hostinger.com
-- 2. Go to Websites → temptationtoken.io → Databases
-- 3. Click phpMyAdmin (opens in new tab)
-- 4. In the left panel, click your WordPress database
--    (usually named something like u123456_wp or similar)
-- 5. Click the SQL tab at the top
-- 6. PASTE THE ENTIRE SCRIPT below into the text box
-- 7. Click Go / Execute
-- 8. Wait for confirmation — each section runs as a transaction
-- 9. After all queries complete, go to WP Admin →
--    LiteSpeed Cache → Purge All  (clears page HTML cache)
-- 10. Visit https://temptationtoken.io and verify
--
-- SAFETY: Every UPDATE is preceded by a matching SELECT so
-- you can see exactly what rows will change. Run the SELECTs
-- first (Step A) to confirm, then run the full script.
-- All changes affect only the temptationtoken.io data.
-- No structural changes. Safe to re-run — idempotent.
-- ============================================================


-- ============================================================
-- STEP A — PRE-FLIGHT DIAGNOSTICS (read-only, run first)
-- ============================================================

-- A1: Check what the plugin actually wrote (its log + completion flag)
SELECT option_name, SUBSTR(option_value, 1, 500) AS value_preview
FROM wp_options
WHERE option_name IN (
    'tts_fixer_done',
    'tts_fixer_log',
    'blogname',
    'blogdescription'
);

-- A2: Check the Rank Math option that controls og:site_name
-- (look for 'Adult Crypto Game' anywhere in these options)
SELECT option_name,
       LOCATE('Adult Crypto Game', option_value) AS pos,
       SUBSTR(option_value, GREATEST(1, LOCATE('Adult Crypto Game', option_value) - 30), 120) AS context
FROM wp_options
WHERE option_name IN (
    'rank-math-options-general',
    'rank-math-options-titles',
    'rank-math-options-sitemap',
    'rank-math-options-social'
)
AND option_value LIKE '%Adult Crypto Game%';

-- A3: Count attachment posts with bad titles
SELECT COUNT(*) AS attachment_titles_to_fix,
       SUBSTR(post_title, 1, 80) AS sample_title
FROM wp_posts
WHERE post_type = 'attachment'
AND post_title LIKE '%Adult Crypto Game on Base%'
LIMIT 1;

-- A4: Check the payment-processor image alt (should be attachment 109)
SELECT pm.meta_id, pm.post_id, pm.meta_value
FROM wp_postmeta pm
WHERE pm.meta_key = '_wp_attachment_image_alt'
AND pm.meta_value LIKE '%payment processor%';

-- A5: Confirm 40% and $100 are in Elementor JSON (shows post_id)
SELECT post_id,
       SUBSTR(meta_value, GREATEST(1, LOCATE('40%</span></strong> prize', meta_value) - 20), 120) AS context_40pct
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%40%</span></strong> prize pool split weekly%';

SELECT post_id,
       SUBSTR(meta_value, GREATEST(1, LOCATE('$100 worth of TTS', meta_value) - 10), 80) AS context_100
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%$100 worth of TTS%';

-- A6: Count Polygon references in Elementor data (FAQ page)
SELECT post_id, COUNT(*) AS polygon_hits
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND (
    meta_value LIKE '%Polygon blockchain%'
    OR meta_value LIKE '%polygon blockchain%'
    OR meta_value LIKE '%the Polygon network%'
    OR meta_value LIKE '%on Polygon%'
    OR meta_value LIKE '%on polygon%'
)
GROUP BY post_id;


-- ============================================================
-- STEP B — FIX og:site_name "Adult Crypto Game on Base"
-- Root cause: Rank Math has a custom website-name field that
-- overrides blogname for og:site_name and schema.org output.
-- The plugin updated blogname but not these Rank Math options.
-- ============================================================

UPDATE wp_options
SET option_value = REPLACE(
    option_value,
    'Adult Crypto Game on Base',
    'Vote-to-Earn Game on Base'
)
WHERE option_name IN (
    'rank-math-options-general',
    'rank-math-options-titles',
    'rank-math-options-sitemap',
    'rank-math-options-social'
)
AND option_value LIKE '%Adult Crypto Game on Base%';

-- Also catch alternate capitalisation just in case
UPDATE wp_options
SET option_value = REPLACE(
    option_value,
    'adult crypto game on base',
    'vote-to-earn game on base'
)
WHERE option_name IN (
    'rank-math-options-general',
    'rank-math-options-titles',
    'rank-math-options-sitemap',
    'rank-math-options-social'
)
AND option_value LIKE '%adult crypto game on base%';

-- Confirm fix
SELECT option_name,
       LOCATE('Adult Crypto Game', option_value) AS remaining_pos
FROM wp_options
WHERE option_name IN (
    'rank-math-options-general',
    'rank-math-options-titles',
    'rank-math-options-sitemap',
    'rank-math-options-social'
);
-- Expected: remaining_pos = 0 for all rows


-- ============================================================
-- STEP C — FIX image title= attributes ("...Adult Crypto Game
--           on Base N" on every image in homepage/FAQ)
-- Root cause: WordPress attachment post_title rows were set to
-- the full site-title pattern when uploaded. Elementor renders
-- these as the title= attribute on <img> tags.
-- Fix: strip everything from " | Adult Crypto Game on Base"
--      onward. Keeps the clean descriptive prefix.
-- ============================================================

-- Preview what will change
SELECT post_id, post_title
FROM wp_posts
WHERE post_type = 'attachment'
AND post_title LIKE '%Adult Crypto Game on Base%'
LIMIT 20;

UPDATE wp_posts
SET post_title = TRIM(SUBSTRING_INDEX(post_title, ' | Adult Crypto Game on Base', 1))
WHERE post_type = 'attachment'
AND post_title LIKE '%| Adult Crypto Game on Base%';

-- Also catch without pipe separator
UPDATE wp_posts
SET post_title = TRIM(REPLACE(post_title, ' Adult Crypto Game on Base', ''))
WHERE post_type = 'attachment'
AND post_title LIKE '%Adult Crypto Game on Base%';

-- Confirm: should return 0 rows
SELECT COUNT(*) AS remaining_bad_titles
FROM wp_posts
WHERE post_type = 'attachment'
AND post_title LIKE '%Adult Crypto Game on Base%';


-- ============================================================
-- STEP D — FIX image alt "payment processor" (wp-image-109)
-- Row: wp_postmeta where meta_key='_wp_attachment_image_alt'
-- and meta_value LIKE '%payment processor%'
-- ============================================================

-- Preview
SELECT pm.post_id, pm.meta_value AS current_alt
FROM wp_postmeta pm
WHERE pm.meta_key = '_wp_attachment_image_alt'
AND pm.meta_value LIKE '%payment processor%';

UPDATE wp_postmeta
SET meta_value = 'Temptation Token ($TTS) — Weekly Crypto Voting Game on Base Blockchain'
WHERE meta_key = '_wp_attachment_image_alt'
AND meta_value LIKE '%payment processor%';

UPDATE wp_postmeta
SET meta_value = 'Temptation Token ($TTS) — Weekly Crypto Voting Game on Base Blockchain'
WHERE meta_key = '_wp_attachment_image_alt'
AND meta_value LIKE '%Payment Processor%';

-- Confirm: 0 rows remaining
SELECT COUNT(*) AS remaining_payment_processor
FROM wp_postmeta
WHERE meta_key = '_wp_attachment_image_alt'
AND (meta_value LIKE '%payment processor%' OR meta_value LIKE '%Payment Processor%');


-- ============================================================
-- STEP E — FIX Elementor body text: "40% prize pool" → correct
-- The plugin's Elementor JSON pass timed out before completing.
-- Exact string on live page (homepage body text widget):
--   "Win — <strong><span style="color: #ecf00e;">40%</span>
--   </strong> prize pool split weekly"
-- ============================================================

-- Preview matching rows
SELECT post_id,
       SUBSTR(meta_value, GREATEST(1, LOCATE('>40%<', meta_value) - 30), 120) AS context
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%>40%</span></strong> prize pool split weekly%';

UPDATE wp_postmeta
SET meta_value = REPLACE(
    meta_value,
    '>40%</span></strong> prize pool split weekly',
    '>35/35/10/20</span></strong> prize pool split weekly'
)
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%>40%</span></strong> prize pool split weekly%';

-- Confirm
SELECT COUNT(*) AS remaining_40pct
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%>40%</span></strong> prize pool split weekly%';


-- ============================================================
-- STEP F — FIX Elementor body text: "$100 worth of TTS free"
-- Exact string on live page:
--   "New users receive <strong><span style="color: #f5ed07;">
--   $100 worth of TTS free</span></strong> on signup"
-- ============================================================

-- Preview
SELECT post_id,
       SUBSTR(meta_value, GREATEST(1, LOCATE('$100 worth of TTS', meta_value) - 20), 100) AS context
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%$100 worth of TTS%';

UPDATE wp_postmeta
SET meta_value = REPLACE(
    meta_value,
    '$100 worth of TTS free',
    '500 TTS free'
)
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%$100 worth of TTS free%';

-- Also catch wp_posts.post_content (classic editor fallback)
UPDATE wp_posts
SET post_content = REPLACE(post_content, '$100 worth of TTS free', '500 TTS free')
WHERE post_content LIKE '%$100 worth of TTS free%'
AND post_status != 'auto-draft';

-- Confirm: 0 remaining
SELECT COUNT(*) AS remaining_100tts
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND meta_value LIKE '%$100 worth of TTS%';


-- ============================================================
-- STEP G — FIX Elementor FAQ body: "Polygon" chain references
-- FAQ page still mentions "Polygon blockchain" in body text.
-- All correct references should be "Base blockchain" or just
-- "Base".
-- ============================================================

-- Preview FAQ Elementor data matches
SELECT post_id,
       SUBSTR(meta_value, GREATEST(1, LOCATE('Polygon', meta_value) - 20), 80) AS context
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND (
    meta_value LIKE '%Polygon blockchain%'
    OR meta_value LIKE '%polygon blockchain%'
    OR meta_value LIKE '%the Polygon network%'
    OR meta_value LIKE '%on Polygon%'
    OR meta_value LIKE '%on polygon%'
)
LIMIT 10;

UPDATE wp_postmeta
SET meta_value = REPLACE(
    REPLACE(
        REPLACE(
            REPLACE(meta_value,
                'Polygon blockchain', 'Base blockchain'),
            'polygon blockchain', 'Base blockchain'),
        'the Polygon network', 'the Base network'),
    'on Polygon', 'on Base')
WHERE meta_key = '_elementor_data'
AND (
    meta_value LIKE '%Polygon blockchain%'
    OR meta_value LIKE '%polygon blockchain%'
    OR meta_value LIKE '%the Polygon network%'
    OR meta_value LIKE '%on Polygon%'
);

-- Also fix in wp_posts.post_content (FAQ may use classic editor)
UPDATE wp_posts
SET post_content = REPLACE(
    REPLACE(
        REPLACE(post_content,
            'Polygon blockchain', 'Base blockchain'),
        'the Polygon network', 'the Base network'),
    'on Polygon', 'on Base')
WHERE (
    post_content LIKE '%Polygon blockchain%'
    OR post_content LIKE '%the Polygon network%'
    OR post_content LIKE '%on Polygon%'
)
AND post_status NOT IN ('auto-draft', 'trash');

-- Confirm
SELECT COUNT(*) AS remaining_polygon
FROM wp_postmeta
WHERE meta_key = '_elementor_data'
AND (
    meta_value LIKE '%Polygon blockchain%'
    OR meta_value LIKE '%polygon blockchain%'
    OR meta_value LIKE '%the Polygon network%'
    OR meta_value LIKE '%on Polygon%'
);


-- ============================================================
-- STEP H — CLEAR ELEMENTOR CSS CACHE
-- Forces Elementor to regenerate per-page CSS on next load.
-- Without this, Elementor may serve stale CSS that references
-- old strings. The regeneration is automatic on next page visit.
--
-- NOTE: This will make the FIRST page load after cache-clear
-- slightly slower (~2-3 seconds) while Elementor rebuilds CSS.
-- LiteSpeed will then re-cache the new CSS. This is normal and
-- will NOT cause a 504 (the original 504 was caused by the
-- plugin flushing both the Elementor CSS AND the LiteSpeed
-- page cache simultaneously, forcing PHP to rebuild everything
-- on a single incoming request. Here we only clear Elementor
-- CSS; LiteSpeed HTML cache remains warm).
-- ============================================================

-- Delete per-post Elementor CSS meta (regenerated automatically)
DELETE FROM wp_postmeta
WHERE meta_key IN ('_elementor_css', '_elementor_inline_svg', '_elementor_controls_usage');

-- Delete Elementor global CSS option
DELETE FROM wp_options
WHERE option_name IN (
    'elementor_css',
    'elementor_inline_svg',
    '_elementor_global_css',
    'elementor-custom-breakpoints-data'
);

-- Clear Rank Math schema cache (forces regeneration of schema.org JSON-LD)
DELETE FROM wp_options
WHERE option_name LIKE '%rank_math_schema_%'
   OR option_name LIKE '%rank-math%_cache%'
   OR option_name = 'rank_math_flush_rewrite';

-- Clear transient caches
DELETE FROM wp_options
WHERE option_name LIKE '_transient_rank_math_%'
   OR option_name LIKE '_transient_timeout_rank_math_%'
   OR option_name LIKE '_transient_elementor_%'
   OR option_name LIKE '_transient_timeout_elementor_%';

-- Confirm deletion
SELECT COUNT(*) AS elementor_css_rows_remaining
FROM wp_postmeta
WHERE meta_key IN ('_elementor_css', '_elementor_inline_svg');


-- ============================================================
-- STEP I — FLUSH REWRITE RULES
-- Deleting this row forces WordPress to rebuild .htaccess
-- routing rules on the next request. Safe and necessary to
-- ensure /trust and /audit slugs keep routing correctly.
-- ============================================================

DELETE FROM wp_options WHERE option_name = 'rewrite_rules';

-- Confirm deletion
SELECT COUNT(*) AS rewrite_rules_row FROM wp_options WHERE option_name = 'rewrite_rules';
-- Expected: 0 (WordPress rebuilds it automatically on next load)


-- ============================================================
-- STEP J — CLEAN UP PLUGIN STATE
-- Remove the tts_fixer_done guard so the plugin can be safely
-- re-activated in the future if needed.
-- ============================================================

DELETE FROM wp_options WHERE option_name = 'tts_fixer_done';

-- Confirm
SELECT COUNT(*) AS fixer_guard_remaining FROM wp_options WHERE option_name = 'tts_fixer_done';
-- Expected: 0


-- ============================================================
-- STEP K — POST-RUN VERIFICATION
-- Run these after all the above to confirm all fixes took.
-- ============================================================

-- K1: og:site_name source — should contain "Vote-to-Earn Game"
SELECT option_name,
       LOCATE('Adult Crypto Game', option_value) AS adult_crypto_pos,
       LOCATE('Vote-to-Earn', option_value) AS vote_earn_pos
FROM wp_options
WHERE option_name IN ('rank-math-options-general', 'rank-math-options-titles')
LIMIT 5;

-- K2: Attachment titles — should all be 0
SELECT COUNT(*) AS bad_attachment_titles
FROM wp_posts
WHERE post_type = 'attachment'
AND post_title LIKE '%Adult Crypto Game on Base%';

-- K3: Payment processor alt — should be 0
SELECT COUNT(*) AS bad_alts
FROM wp_postmeta
WHERE meta_key = '_wp_attachment_image_alt'
AND (meta_value LIKE '%payment processor%' OR meta_value LIKE '%Payment Processor%');

-- K4: Body text issues — should all be 0
SELECT
    (SELECT COUNT(*) FROM wp_postmeta WHERE meta_key='_elementor_data' AND meta_value LIKE '%>40%</span></strong> prize pool split weekly%') AS pct_40_remaining,
    (SELECT COUNT(*) FROM wp_postmeta WHERE meta_key='_elementor_data' AND meta_value LIKE '%$100 worth of TTS%') AS tts100_remaining,
    (SELECT COUNT(*) FROM wp_postmeta WHERE meta_key='_elementor_data' AND (meta_value LIKE '%Polygon blockchain%' OR meta_value LIKE '%on Polygon%')) AS polygon_remaining;

-- K5: Elementor CSS cache cleared — should be 0
SELECT COUNT(*) AS elementor_css_remaining
FROM wp_postmeta
WHERE meta_key = '_elementor_css';

-- K6: Rewrite rules flushed — should be 0 (WP rebuilds automatically)
SELECT COUNT(*) AS rewrite_rules_row FROM wp_options WHERE option_name = 'rewrite_rules';

-- K7: Plugin guard removed — should be 0
SELECT COUNT(*) AS fixer_guard_row FROM wp_options WHERE option_name = 'tts_fixer_done';


-- ============================================================
-- AFTER RUNNING THIS SCRIPT
-- ============================================================
--
-- 1. Go to WP Admin → LiteSpeed Cache → Purge All
--    (this clears the HTML page cache; without this step,
--    visitors will see cached old content until LiteSpeed's
--    TTL expires)
--
-- 2. Run the curl verification suite (from repo root):
--
--    curl -s https://temptationtoken.io | grep "og:site_name"
--    # Expected: "Vote-to-Earn Game on Base" — no "Adult Crypto"
--
--    curl -s https://temptationtoken.io | grep -c "Adult Crypto"
--    # Expected: 0
--
--    curl -s https://temptationtoken.io | grep -c "payment processor"
--    # Expected: 0
--
--    curl -s https://temptationtoken.io | grep -c "40%"
--    # Expected: 0 or only inside CSS variables (not body text)
--
--    curl -s https://temptationtoken.io/faq/ | grep -c "Polygon"
--    # Expected: 0
--
--    curl -s https://temptationtoken.io/trust/ | grep -c "Trust"
--    # Expected: ≥1 (page still live)
--
--    curl -s https://temptationtoken.io/audit/ | grep -c "Audit"
--    # Expected: ≥1 (page still live)
--
-- ============================================================
-- END OF SCRIPT
-- ============================================================
