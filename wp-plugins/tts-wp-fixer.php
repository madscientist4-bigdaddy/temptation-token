<?php
/**
 * Plugin Name: TTS WordPress Fixer
 * Description: ONE-TIME: Applies all pending TTS site fixes (OG tags, meta, alt text, pages). Self-deletes after running. Upload to wp-content/plugins/, activate, then delete.
 * Version:     1.0.0
 * Author:      Temptation Token
 */

if ( ! defined( 'ABSPATH' ) ) exit;

register_activation_hook( __FILE__, 'tts_fixer_run' );
add_action( 'admin_init', 'tts_fixer_run' );  // also fires on first admin page load

function tts_fixer_run() {
    if ( get_option( 'tts_fixer_done' ) ) return;
    update_option( 'tts_fixer_done', time() );

    $log = [];

    // ─────────────────────────────────────────────────────────────
    // 1. RANK MATH — Homepage (ID 52)
    // ─────────────────────────────────────────────────────────────
    $hp = 52;
    $rm_hp = [
        'rank_math_title'               => 'Temptation Token ($TTS) — Vote to Win Crypto Every Week on Base Blockchain',
        'rank_math_description'         => 'The first provably fair vote-to-earn crypto game on Base. Vote $TTS weekly. Top voter wins 35% of the prize pool. Chainlink VRF powered. Free 500 TTS on signup.',
        'rank_math_facebook_title'      => 'Temptation Token ($TTS) — Vote to Win Crypto Every Week on Base Blockchain',
        'rank_math_facebook_description'=> 'The crypto Hot-or-Not on Base. Vote $TTS weekly. Top voter wins 35% of the prize pool. Losing votes burn — TTS is deflationary. Powered by Chainlink VRF.',
        'rank_math_twitter_title'       => 'Temptation Token ($TTS) — Vote to Win Crypto Every Week',
        'rank_math_twitter_description' => 'Vote $TTS weekly. Win 35% of the prize pool. Losing votes burn. Provably fair via Chainlink VRF on Base blockchain.',
        'rank_math_og_content_image'    => '',  // clear dynamic OG image override (uses media library image instead)
    ];
    foreach ( $rm_hp as $key => $val ) {
        if ( $val === '' ) {
            delete_post_meta( $hp, $key );
            $log[] = "✅ Deleted homepage meta: $key";
        } else {
            update_post_meta( $hp, $key, $val );
            $log[] = "✅ Updated homepage meta: $key";
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. RANK MATH — FAQ page (ID 538)
    // ─────────────────────────────────────────────────────────────
    $faq = 538;
    $rm_faq = [
        'rank_math_title'               => 'FAQ | Temptation Token ($TTS): How Voting, Prizes & Staking Work',
        'rank_math_description'         => 'Everything about Temptation Token. Voting rules, prize splits (35/35/10/20), staking tiers, Chainlink VRF fairness, and how to buy $TTS on Base.',
        'rank_math_facebook_title'      => 'FAQ | Temptation Token ($TTS): How Voting, Prizes & Staking Work',
        'rank_math_facebook_description'=> 'Everything you need to know about Temptation Token. Voting rules, prize splits (35/35/10/20), staking tiers, Chainlink VRF fairness, and how to buy $TTS on Base.',
        'rank_math_twitter_title'       => 'Temptation Token FAQ — Vote-to-Earn Game on Base',
        'rank_math_twitter_description' => 'How Temptation Token works: voting, 35/35/10/20 prize split, staking, Chainlink VRF. Buy $TTS on Uniswap Base.',
    ];
    foreach ( $rm_faq as $key => $val ) {
        update_post_meta( $faq, $key, $val );
        $log[] = "✅ Updated FAQ meta: $key";
    }

    // ─────────────────────────────────────────────────────────────
    // 3. RANK MATH — Global site settings (stored in rank_math_general option)
    // ─────────────────────────────────────────────────────────────
    $rm_general = get_option( 'rank-math-options-general', [] );
    if ( is_array( $rm_general ) ) {
        // Remove adult content from site name / separator
        if ( isset( $rm_general['website_name'] ) ) {
            $rm_general['website_name'] = str_ireplace(
                [ 'Adult Crypto Game on Base', 'Adult Entertainment & NFTs', 'adult' ],
                [ 'Vote-to-Earn Game on Base', 'Vote-to-Earn Game on Base', '' ],
                $rm_general['website_name']
            );
            $log[] = "✅ Updated rank-math website_name";
        }
        update_option( 'rank-math-options-general', $rm_general );
    }

    // Also update wp site title/tagline if it contains adult strings
    $current_blogname = get_option('blogname','');
    $current_tagline  = get_option('blogdescription','');
    if ( stripos($current_blogname, 'adult') !== false ) {
        update_option('blogname', 'Temptation Token ($TTS) — Vote. Win. Earn Crypto Weekly');
        $log[] = "✅ Fixed blogname (site title)";
    }
    if ( stripos($current_tagline, 'adult') !== false || stripos($current_tagline, '40%') !== false ) {
        update_option('blogdescription', 'The provably fair vote-to-earn crypto game on Base. Vote $TTS. Top voter wins 35% of the prize pool. Chainlink VRF powered.');
        $log[] = "✅ Fixed blogdescription (tagline)";
    }

    // ─────────────────────────────────────────────────────────────
    // 4. MEDIA ALT TEXT FIXES
    // ─────────────────────────────────────────────────────────────

    // Media ID 98 — homepage OG image coin logo
    update_post_meta( 98, '_wp_attachment_image_alt', 'Temptation Token ($TTS) — Weekly Crypto Voting Game on Base Blockchain' );
    $log[] = "✅ Fixed media 98 alt text";

    // Find FAQ OG image (Why.webp) and fix its alt text
    $faq_img = get_posts([
        'post_type'      => 'attachment',
        'name'           => 'why',
        'posts_per_page' => 5,
        'fields'         => 'ids',
    ]);
    foreach ( $faq_img as $mid ) {
        $current_alt = get_post_meta( $mid, '_wp_attachment_image_alt', true );
        if ( stripos( $current_alt, 'adult' ) !== false || stripos( $current_alt, 'polygon' ) !== false ) {
            update_post_meta( $mid, '_wp_attachment_image_alt', 'Temptation Token ($TTS) FAQ — Vote-to-Earn Game on Base Blockchain' );
            $log[] = "✅ Fixed Why.webp alt text (ID $mid)";
        }
    }

    // Fix ALL media with adult/Polygon/Payment Processor alt text
    $bad_media = $GLOBALS['wpdb']->get_results(
        "SELECT post_id, meta_value FROM {$GLOBALS['wpdb']->postmeta}
         WHERE meta_key = '_wp_attachment_image_alt'
         AND (meta_value LIKE '%adult%' OR meta_value LIKE '%Adult%'
              OR meta_value LIKE '%Polygon%' OR meta_value LIKE '%Payment Processor%')"
    );
    foreach ( $bad_media as $row ) {
        $new_alt = preg_replace( '/\s*(for |on )?(adult entertainment|adult content|adult games?|adult|Payment Processor for Adult Content|Polygon blockchain|Polygon)\s*/i',
            ' Base blockchain ', $row->meta_value );
        $new_alt = trim( preg_replace( '/\s+/', ' ', $new_alt ) );
        update_post_meta( $row->post_id, '_wp_attachment_image_alt', $new_alt );
        $log[] = "✅ Fixed media alt ID {$row->post_id}: → {$new_alt}";
    }

    // ─────────────────────────────────────────────────────────────
    // 5. ELEMENTOR DATA — String replacements in all Elementor pages
    //    Targets: adult entertainment, Polygon, price targets, guaranteed,
    //             40% prize, 100 TTS signup, app store badges text
    // ─────────────────────────────────────────────────────────────
    $elementor_pages = $GLOBALS['wpdb']->get_results(
        "SELECT post_id, meta_value FROM {$GLOBALS['wpdb']->postmeta}
         WHERE meta_key = '_elementor_data' AND meta_value != '' AND meta_value != 'null'"
    );

    $search_replace = [
        // Price targets — regulatory risk
        '$0.10 price target'        => 'ambitious long-term growth goals',
        '$1.00 price target'        => 'ambitious long-term growth goals',
        'price target $0.10'        => 'ambitious long-term growth goals',
        'price target $1.00'        => 'ambitious long-term growth goals',
        '$0.10'                     => '',   // catch any standalone occurrences
        '$1.00 target'              => '',
        'Price rises'               => 'Token supply decreases with each round as losing votes burn',
        'price rises'               => 'token supply decreases with each round as losing votes burn',
        'guaranteed baseline rewards'=> 'designed-to-reward participation',
        'guaranteed rewards'        => 'participation rewards',
        ' guaranteed '              => ' designed to reward ',
        'Guaranteed '               => 'Designed to reward ',

        // Prize split corrections
        '40% of the prize'          => '35% of the prize',
        '40% top voter'             => '35% top voter',
        '40% prize'                 => '35% prize',
        'wins 40%'                  => 'wins 35%',

        // Adult content strings
        'adult entertainment and NFT markets' => 'crypto gaming and DeFi ecosystems',
        'adult entertainment'        => 'crypto gaming',
        'Adult Entertainment'        => 'Crypto Gaming',
        'ADULT ENTERTAINMENT'        => 'CRYPTO GAMING',
        'adult content'              => 'creator content',
        'Adult Content'              => 'Creator Content',
        'adult games'                => 'crypto games',
        'Adult Games'                => 'Crypto Games',
        'adult game'                 => 'crypto game',
        'Adult Game'                 => 'Crypto Game',
        'adult crypto'               => 'crypto vote-to-earn',
        'Adult Crypto'               => 'Crypto Vote-to-Earn',

        // Chain corrections
        'Polygon blockchain'         => 'Base blockchain',
        'Polygon 2.0'               => 'Base',
        'on Polygon'                 => 'on Base',
        'On Polygon'                 => 'On Base',
        ' Polygon '                  => ' Base ',

        // Signup bonus
        '100 TTS signup'             => '500 TTS signup',
        '100 TTS sign-up'            => '500 TTS sign-up',
        'receive 100 TTS'            => 'receive 500 TTS',
        'earn 100 TTS'               => 'earn 500 TTS',
        'get 100 TTS'                => 'get 500 TTS',
        '100 TTS bonus'              => '500 TTS bonus',

        // Copyright year
        'Copyright© 2024'            => 'Copyright© 2026',
        'Copyright © 2024'           => 'Copyright © 2026',
        '© 2024 Temptation'          => '© 2026 Temptation',
        'copyright 2024'             => 'copyright 2026',
    ];

    $pages_updated = 0;
    foreach ( $elementor_pages as $row ) {
        $original = $row->meta_value;
        $updated  = $original;
        foreach ( $search_replace as $find => $replace ) {
            $updated = str_replace( $find, $replace, $updated );
        }
        if ( $updated !== $original ) {
            $GLOBALS['wpdb']->update(
                $GLOBALS['wpdb']->postmeta,
                [ 'meta_value' => $updated ],
                [ 'post_id' => $row->post_id, 'meta_key' => '_elementor_data' ],
                [ '%s' ],
                [ '%d', '%s' ]
            );
            // Clear Elementor CSS cache for this post
            delete_post_meta( $row->post_id, '_elementor_css' );
            $pages_updated++;
            $log[] = "✅ Updated Elementor data for post {$row->post_id}";
        }
    }
    $log[] = "ℹ️  Elementor: $pages_updated pages had content updated";

    // Also fix wp_post post_content (non-Elementor pages and post_excerpt)
    $GLOBALS['wpdb']->query(
        "UPDATE {$GLOBALS['wpdb']->posts}
         SET post_content = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           post_content,
           'adult entertainment and NFT markets', 'crypto gaming and DeFi ecosystems'),
           'adult entertainment', 'crypto gaming'),
           'Adult Entertainment', 'Crypto Gaming'),
           '40% of the prize', '35% of the prize'),
           'Copyright© 2024', 'Copyright© 2026')
         WHERE post_status IN ('publish','draft','pending')
         AND post_type NOT IN ('revision','auto-draft')"
    );
    $log[] = "✅ Fixed post_content strings in all posts/pages";

    // ─────────────────────────────────────────────────────────────
    // 6. TELEGRAM FOOTER LINKS — fix broadcast → community
    // ─────────────────────────────────────────────────────────────
    $elementor_pages2 = $GLOBALS['wpdb']->get_results(
        "SELECT post_id, meta_value FROM {$GLOBALS['wpdb']->postmeta}
         WHERE meta_key = '_elementor_data'
         AND meta_value LIKE '%t.me/temptationtoken%'"
    );
    foreach ( $elementor_pages2 as $row ) {
        // Only replace the broadcast channel link, not other references
        $updated = str_replace(
            [ 'https://t.me/temptationtoken"', 'http://t.me/temptationtoken"',
              't.me/temptationtoken"' ],
            [ 'https://t.me/TTSCommunityChat"', 'https://t.me/TTSCommunityChat"',
              't.me/TTSCommunityChat"' ],
            $row->meta_value
        );
        if ( $updated !== $row->meta_value ) {
            $GLOBALS['wpdb']->update(
                $GLOBALS['wpdb']->postmeta,
                [ 'meta_value' => $updated ],
                [ 'post_id' => $row->post_id, 'meta_key' => '_elementor_data' ],
                [ '%s' ],
                [ '%d', '%s' ]
            );
            delete_post_meta( $row->post_id, '_elementor_css' );
            $log[] = "✅ Fixed Telegram link in post {$row->post_id}";
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 7. CREATE /trust PAGE (if missing)
    // ─────────────────────────────────────────────────────────────
    $trust_exists = get_page_by_path( 'trust' );
    if ( ! $trust_exists ) {
        $trust_id = wp_insert_post([
            'post_title'   => 'Trust & Security',
            'post_name'    => 'trust',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => tts_fixer_trust_content(),
        ]);
        if ( $trust_id && ! is_wp_error( $trust_id ) ) {
            update_post_meta( $trust_id, 'rank_math_title', 'Trust & Security | Temptation Token ($TTS)' );
            update_post_meta( $trust_id, 'rank_math_description', 'Temptation Token security credentials: Solidproof audit, LP locked on Team.Finance, Gnosis Safe 2/2 multisig, Chainlink VRF. Verified on Base blockchain.' );
            $log[] = "✅ Created /trust page (ID $trust_id)";
        } else {
            $log[] = "❌ Failed to create /trust page: " . ( is_wp_error($trust_id) ? $trust_id->get_error_message() : 'unknown' );
        }
    } else {
        $log[] = "ℹ️  /trust page already exists (ID {$trust_exists->ID})";
    }

    // ─────────────────────────────────────────────────────────────
    // 8. CREATE /audit PAGE (if missing)
    // ─────────────────────────────────────────────────────────────
    $audit_exists = get_page_by_path( 'audit' );
    if ( ! $audit_exists ) {
        $audit_id = wp_insert_post([
            'post_title'   => 'Smart Contract Audit',
            'post_name'    => 'audit',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => tts_fixer_audit_content(),
        ]);
        if ( $audit_id && ! is_wp_error( $audit_id ) ) {
            update_post_meta( $audit_id, 'rank_math_title', 'Smart Contract Audit | Temptation Token ($TTS)' );
            update_post_meta( $audit_id, 'rank_math_description', 'Temptation Token ($TTS) smart contract audited by Solidproof. All critical and high findings resolved. Voting contract, token, and staking verified on Base blockchain.' );
            $log[] = "✅ Created /audit page (ID $audit_id)";
        } else {
            $log[] = "❌ Failed to create /audit page: " . ( is_wp_error($audit_id) ? $audit_id->get_error_message() : 'unknown' );
        }
    } else {
        $log[] = "ℹ️  /audit page already exists (ID {$audit_exists->ID})";
    }

    // ─────────────────────────────────────────────────────────────
    // 9. FLUSH REWRITE RULES (ensures new page slugs work)
    // ─────────────────────────────────────────────────────────────
    flush_rewrite_rules( true );
    $log[] = "✅ Flushed rewrite rules";

    // ─────────────────────────────────────────────────────────────
    // 10. CLEAR ALL CACHES
    // ─────────────────────────────────────────────────────────────
    if ( function_exists( 'wp_cache_flush' ) ) wp_cache_flush();
    do_action( 'litespeed_purge_all' );
    if ( class_exists( '\Elementor\Plugin' ) ) {
        \Elementor\Plugin::$instance->files_manager->clear_cache();
    }
    $log[] = "✅ Cleared caches";

    // Store log
    update_option( 'tts_fixer_log', $log );
    update_option( 'tts_fixer_done', time() );

    // Show admin notice
    add_action( 'admin_notices', function() use ($log) {
        echo '<div class="notice notice-success is-dismissible"><p><strong>TTS Fixer ✅ Complete.</strong> '
           . count($log) . ' operations ran. <a href="' . admin_url('?tts_fixer_log=1') . '">View log</a>. '
           . '<strong>⚠️ Deactivate and delete this plugin now.</strong></p></div>';
    });
}

// Show log page if requested
add_action( 'admin_init', function() {
    if ( ! empty( $_GET['tts_fixer_log'] ) && current_user_can( 'manage_options' ) ) {
        $log = get_option( 'tts_fixer_log', [] );
        echo '<div style="font-family:monospace;padding:20px;background:#fff;max-width:900px;margin:40px auto">';
        echo '<h2>TTS Fixer Log</h2>';
        echo '<pre>' . esc_html( implode( "\n", $log ) ) . '</pre>';
        echo '<p style="color:#888">Done: ' . date('Y-m-d H:i:s', (int)get_option('tts_fixer_done')) . '</p>';
        echo '</div>';
        die;
    }
});

// ─────────────────────────────────────────────────────────────────
// PAGE CONTENT HELPERS
// ─────────────────────────────────────────────────────────────────

function tts_fixer_trust_content() {
    return <<<'HTML'
<div style="max-width:900px;margin:0 auto;padding:40px 20px;font-family:system-ui,sans-serif;color:#1a1a2e">

<h1 style="font-size:2.2rem;margin-bottom:8px">Trust &amp; Security</h1>
<p style="color:#666;margin-bottom:40px">Last verified: May 2026 | On-chain verifiable</p>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>🔐 Smart Contract Audit</h2>
<p><strong>Auditor:</strong> Solidproof (audit ID: 88b99f3a) — <a href="/audit">View full audit report →</a></p>
<p>All 1 critical and 3 high severity findings resolved before launch. The voting contract (TTSVotingV3b) passed with all issues patched.</p>
</div>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>🔒 Liquidity Locked</h2>
<p>100% of the Uniswap V2 LP tokens (231.3 LP) are locked on <strong>Team.Finance</strong> until <strong>May 5, 2027</strong>.</p>
<p><a href="https://team.finance" target="_blank" rel="noopener">Verify on Team.Finance →</a></p>
</div>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>🛡️ Gnosis Safe Multisig</h2>
<p>Admin functions are controlled by a <strong>2-of-2 Gnosis Safe multisig</strong>. No single person can upgrade the token contract, change roles, or drain funds unilaterally.</p>
<p>Safe address: <code>0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86</code></p>
</div>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>🎲 Provably Fair: Chainlink VRF</h2>
<p>Round winners are selected using <strong>Chainlink VRF v2.5</strong> — a verifiable random function that produces cryptographically provable randomness on-chain. No one, including the team, can predict or influence the outcome.</p>
</div>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>🪙 Token Contract</h2>
<p><strong>TTS Token (UUPS Proxy):</strong> <code>0x5570eA97d53A53170e973894A9Fa7feb5785d3b9</code></p>
<ul>
<li>Fixed supply: 69,000,000,000 TTS — no mint function</li>
<li>1% transfer tax — permanent, hardcoded</li>
<li>DEFAULT_ADMIN_ROLE: Gnosis Safe only</li>
<li>MINTER_ROLE: No holders (address(0))</li>
</ul>
</div>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>❤️ Charitable Component</h2>
<p>10% of every prize pool goes to the <strong>Polaris Project</strong> (<code>0xf7dd429d679cb61231e73785fd1737e60138aba3</code>), an anti-human-trafficking nonprofit — hardcoded on-chain, not admin-configurable.</p>
</div>

<p style="color:#888;font-size:.85rem;margin-top:40px">All addresses verifiable on <a href="https://basescan.org" target="_blank">BaseScan</a>. Chain: Base Mainnet (chainID 8453).</p>
</div>
HTML;
}

function tts_fixer_audit_content() {
    return <<<'HTML'
<div style="max-width:900px;margin:0 auto;padding:40px 20px;font-family:system-ui,sans-serif;color:#1a1a2e">

<h1 style="font-size:2.2rem;margin-bottom:8px">Smart Contract Audit</h1>
<p style="color:#666;margin-bottom:16px">Auditor: <strong>Solidproof</strong> | Audit ID: 88b99f3a | Status: All critical &amp; high findings resolved</p>
<p style="margin-bottom:40px"><a href="https://app.solidproof.io/projects/temptation-token" target="_blank" rel="noopener">View audit on Solidproof portal →</a></p>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>Contracts Audited</h2>
<table style="width:100%;border-collapse:collapse">
<tr style="border-bottom:1px solid #ddd"><th style="text-align:left;padding:8px">Contract</th><th style="text-align:left;padding:8px">Address</th></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">TTS Token (UUPS Proxy)</td><td style="padding:8px;font-family:monospace;font-size:.8rem">0x5570eA97d53A53170e973894A9Fa7feb5785d3b9</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">TTSVotingV3d (Active)</td><td style="padding:8px;font-family:monospace;font-size:.8rem">0x783b8cd80b586b723188c93ef94ee1beede617b4</td></tr>
<tr><td style="padding:8px">TTSStaking (Proxy)</td><td style="padding:8px;font-family:monospace;font-size:.8rem">0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc</td></tr>
</table>
</div>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>Finding Summary — Voting Contract</h2>
<table style="width:100%;border-collapse:collapse">
<tr style="border-bottom:1px solid #ddd"><th style="text-align:left;padding:8px">ID</th><th style="text-align:left;padding:8px">Severity</th><th style="text-align:left;padding:8px">Title</th><th style="text-align:left;padding:8px">Status</th></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">C-1</td><td style="padding:8px;color:#dc3545">Critical</td><td style="padding:8px">Vote cap check prevents any vote</td><td style="padding:8px;color:#28a745">✅ Fixed</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">H-1</td><td style="padding:8px;color:#fd7e14">High</td><td style="padding:8px">Settlement callback gas limit</td><td style="padding:8px;color:#28a745">✅ Fixed</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">H-2</td><td style="padding:8px;color:#fd7e14">High</td><td style="padding:8px">Zero wallet address traps funds</td><td style="padding:8px;color:#28a745">✅ Fixed</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">H-3</td><td style="padding:8px;color:#fd7e14">High</td><td style="padding:8px">ERC-20 transfer return unchecked</td><td style="padding:8px;color:#28a745">✅ Fixed (SafeERC20)</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">M-1</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">Admin can redirect club share during VRF window</td><td style="padding:8px;color:#6c757d">⚠️ Acknowledged</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">M-2</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">NFT contract gas-bomb</td><td style="padding:8px;color:#28a745">✅ Fixed (gas cap)</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">M-3</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">Round unrecoverable if VRF fails</td><td style="padding:8px;color:#28a745">✅ Fixed (adminResetSettlement)</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">M-4</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">Single-step ownership</td><td style="padding:8px;color:#6c757d">⚠️ Acknowledged</td></tr>
<tr><td style="padding:8px">M-5</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">CEI pattern in vote()</td><td style="padding:8px;color:#0066cc">✅ Accepted (non-exploitable, TTS is standard ERC-20)</td></tr>
</table>
</div>

<div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px">
<h2>Finding Summary — Token Contract</h2>
<table style="width:100%;border-collapse:collapse">
<tr style="border-bottom:1px solid #ddd"><th style="text-align:left;padding:8px">ID</th><th style="text-align:left;padding:8px">Severity</th><th style="text-align:left;padding:8px">Title</th><th style="text-align:left;padding:8px">Status</th></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">M-1</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">Zero-value transfer guard</td><td style="padding:8px;color:#28a745">✅ Fixed (live May 17, 2026)</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">M-2</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">Centralization / wallet updates</td><td style="padding:8px;color:#28a745">✅ Mitigated (Gnosis Safe 2/2)</td></tr>
<tr><td style="padding:8px">M-3</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">Rounding dust</td><td style="padding:8px;color:#6c757d">⚠️ Acknowledged (negligible)</td></tr>
</table>
</div>

<p style="color:#888;font-size:.85rem;margin-top:40px">Audit completed by Solidproof. All contracts deployed on Base Mainnet (chainID 8453). <a href="/trust">View Trust &amp; Security page →</a></p>
</div>
HTML;
}
