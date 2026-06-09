<?php
/**
 * Plugin Name: TTS WordPress Fixer
 * Description: Applies all pending TTS site fixes (OG tags, meta, alt text, Elementor content, pages). Batched across multiple admin page loads — no timeout risk. Tools → TTS Fixer.
 * Version:     2.0.0
 * Author:      Temptation Token
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'TTS_FIXER_BATCH', 3 ); // Elementor pages processed per button click

// ─────────────────────────────────────────────────────────────
// ADMIN MENU
// ─────────────────────────────────────────────────────────────
add_action( 'admin_menu', function () {
    add_management_page(
        'TTS Fixer',
        'TTS Fixer',
        'manage_options',
        'tts-fixer',
        'tts_fixer_admin_page'
    );
} );

// On activation: only run the fast O(1) meta fixes — no table scans.
register_activation_hook( __FILE__, 'tts_fixer_step1_run' );

// ─────────────────────────────────────────────────────────────
// STEP 1 — Fast meta fixes (Rank Math per-page, blogname, tagline, media ID 98)
//           Safe to run on activation: no table scans, no loops.
// ─────────────────────────────────────────────────────────────
function tts_fixer_step1_run() {
    $log = [];
    try {

        // Rank Math — Homepage (ID 52)
        $rm_hp = [
            'rank_math_title'                => 'Temptation Token ($TTS) — Vote to Win Crypto Every Week on Base Blockchain',
            'rank_math_description'          => 'The first provably fair vote-to-earn crypto game on Base. Vote $TTS weekly. Top voter wins 35% of the prize pool. Chainlink VRF powered. Free 500 TTS on signup.',
            'rank_math_facebook_title'       => 'Temptation Token ($TTS) — Vote to Win Crypto Every Week on Base Blockchain',
            'rank_math_facebook_description' => 'The crypto Hot-or-Not on Base. Vote $TTS weekly. Top voter wins 35% of the prize pool. Losing votes burn — TTS is deflationary. Powered by Chainlink VRF.',
            'rank_math_twitter_title'        => 'Temptation Token ($TTS) — Vote to Win Crypto Every Week',
            'rank_math_twitter_description'  => 'Vote $TTS weekly. Win 35% of the prize pool. Losing votes burn. Provably fair via Chainlink VRF on Base blockchain.',
            'rank_math_og_content_image'     => '', // clear dynamic OG image override
        ];
        foreach ( $rm_hp as $key => $val ) {
            if ( $val === '' ) {
                delete_post_meta( 52, $key );
            } else {
                update_post_meta( 52, $key, $val );
            }
            $log[] = "✅ Homepage meta: $key";
        }

        // Rank Math — FAQ page (ID 538)
        $rm_faq = [
            'rank_math_title'                => 'FAQ | Temptation Token ($TTS): How Voting, Prizes & Staking Work',
            'rank_math_description'          => 'Everything about Temptation Token. Voting rules, prize splits (35/35/10/20), staking tiers, Chainlink VRF fairness, and how to buy $TTS on Base.',
            'rank_math_facebook_title'       => 'FAQ | Temptation Token ($TTS): How Voting, Prizes & Staking Work',
            'rank_math_facebook_description' => 'Everything you need to know about Temptation Token. Voting rules, prize splits (35/35/10/20), staking tiers, Chainlink VRF fairness, and how to buy $TTS on Base.',
            'rank_math_twitter_title'        => 'Temptation Token FAQ — Vote-to-Earn Game on Base',
            'rank_math_twitter_description'  => 'How Temptation Token works: voting, 35/35/10/20 prize split, staking, Chainlink VRF. Buy $TTS on Uniswap Base.',
        ];
        foreach ( $rm_faq as $key => $val ) {
            update_post_meta( 538, $key, $val );
            $log[] = "✅ FAQ meta: $key";
        }

        // Rank Math — global site settings
        $rm_general = get_option( 'rank-math-options-general', [] );
        if ( is_array( $rm_general ) && isset( $rm_general['website_name'] ) ) {
            $rm_general['website_name'] = str_ireplace(
                [ 'Adult Crypto Game on Base', 'Adult Entertainment & NFTs', 'adult' ],
                [ 'Vote-to-Earn Game on Base', 'Vote-to-Earn Game on Base', '' ],
                $rm_general['website_name']
            );
            update_option( 'rank-math-options-general', $rm_general );
            $log[] = '✅ Rank Math website_name cleaned';
        }

        // Site title / tagline
        $blogname = get_option( 'blogname', '' );
        $tagline  = get_option( 'blogdescription', '' );
        if ( stripos( $blogname, 'adult' ) !== false ) {
            update_option( 'blogname', 'Temptation Token ($TTS) — Vote. Win. Earn Crypto Weekly' );
            $log[] = '✅ Fixed blogname';
        }
        if ( stripos( $tagline, 'adult' ) !== false || stripos( $tagline, '40%' ) !== false ) {
            update_option( 'blogdescription', 'The provably fair vote-to-earn crypto game on Base. Vote $TTS. Top voter wins 35% of the prize pool. Chainlink VRF powered.' );
            $log[] = '✅ Fixed tagline';
        }

        // Known media ID 98 — homepage OG image
        update_post_meta( 98, '_wp_attachment_image_alt', 'Temptation Token ($TTS) — Weekly Crypto Voting Game on Base Blockchain' );
        $log[] = '✅ Media 98 alt text';

    } catch ( \Throwable $e ) {
        $log[] = '❌ Exception: ' . $e->getMessage();
    }

    tts_fixer_append_log( 1, $log );
    update_option( 'tts_fixer_step1_done', time() );
}

// ─────────────────────────────────────────────────────────────
// STEP 2 — Scan all media library items for bad alt text
//           One targeted postmeta query with LIKE filters.
// ─────────────────────────────────────────────────────────────
function tts_fixer_step2_run() {
    global $wpdb;
    $log = [];
    try {

        // FAQ image by slug ("why.webp")
        $faq_imgs = get_posts( [
            'post_type'      => 'attachment',
            'name'           => 'why',
            'posts_per_page' => 5,
            'fields'         => 'ids',
        ] );
        foreach ( $faq_imgs as $mid ) {
            $alt = get_post_meta( $mid, '_wp_attachment_image_alt', true );
            if ( stripos( $alt, 'adult' ) !== false || stripos( $alt, 'polygon' ) !== false ) {
                update_post_meta( $mid, '_wp_attachment_image_alt', 'Temptation Token ($TTS) FAQ — Vote-to-Earn Game on Base Blockchain' );
                $log[] = "✅ Fixed Why.webp alt (ID $mid)";
            }
        }

        // All media with bad alt text
        $rows = $wpdb->get_results(
            "SELECT post_id, meta_value FROM {$wpdb->postmeta}
             WHERE meta_key = '_wp_attachment_image_alt'
             AND (   meta_value LIKE '%adult%'
                  OR meta_value LIKE '%Adult%'
                  OR meta_value LIKE '%Polygon%'
                  OR meta_value LIKE '%Payment Processor%' )"
        );

        foreach ( $rows as $row ) {
            $new = preg_replace(
                '/\s*(for |on )?(adult entertainment|adult content|adult games?|adult|Payment Processor for Adult Content|Polygon blockchain|Polygon)\s*/i',
                ' Base blockchain ',
                $row->meta_value
            );
            $new = trim( preg_replace( '/\s+/', ' ', $new ) );
            update_post_meta( $row->post_id, '_wp_attachment_image_alt', $new );
            $log[] = "✅ Media ID {$row->post_id} alt → {$new}";
        }

        $log[] = 'ℹ️  Fixed ' . count( $rows ) . ' media alt text(s)';

    } catch ( \Throwable $e ) {
        $log[] = '❌ Exception: ' . $e->getMessage();
    }

    tts_fixer_append_log( 2, $log );
    update_option( 'tts_fixer_step2_done', time() );
}

// ─────────────────────────────────────────────────────────────
// STEP 3 — Post content SQL fix
//           Single native MySQL REPLACE() chain — fast even on large tables.
// ─────────────────────────────────────────────────────────────
function tts_fixer_step3_run() {
    global $wpdb;
    $log = [];
    try {

        $affected = $wpdb->query(
            "UPDATE {$wpdb->posts}
             SET post_content = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
               post_content,
               'adult entertainment and NFT markets', 'crypto gaming and DeFi ecosystems'),
               'adult entertainment',                 'crypto gaming'),
               'Adult Entertainment',                 'Crypto Gaming'),
               '40% of the prize',                    '35% of the prize'),
               'Copyright© 2024',                'Copyright© 2026')
             WHERE post_status IN ('publish','draft','pending')
               AND post_type NOT IN ('revision','auto-draft')"
        );

        $log[] = "✅ post_content SQL: $affected row(s) affected";

    } catch ( \Throwable $e ) {
        $log[] = '❌ Exception: ' . $e->getMessage();
    }

    tts_fixer_append_log( 3, $log );
    update_option( 'tts_fixer_step3_done', time() );
}

// ─────────────────────────────────────────────────────────────
// STEP 4 — Elementor JSON search-replace (BATCHED)
//           Also fixes Telegram links — same data, same pass.
//           Click "Run batch" repeatedly until 100% complete.
// ─────────────────────────────────────────────────────────────

function tts_fixer_el_map() {
    return [
        // Price-target / promissory language
        '$0.10 price target'          => 'ambitious long-term growth goals',
        '$1.00 price target'          => 'ambitious long-term growth goals',
        'price target $0.10'          => 'ambitious long-term growth goals',
        'price target $1.00'          => 'ambitious long-term growth goals',
        '$0.10'                       => '',
        '$1.00 target'                => '',
        'Price rises'                 => 'Token supply decreases with each round as losing votes burn',
        'price rises'                 => 'token supply decreases with each round as losing votes burn',
        'guaranteed baseline rewards' => 'designed-to-reward participation',
        'guaranteed rewards'          => 'participation rewards',
        ' guaranteed '                => ' designed to reward ',
        'Guaranteed '                 => 'Designed to reward ',
        // Prize split
        '40% of the prize'            => '35% of the prize',
        '40% top voter'               => '35% top voter',
        '40% prize'                   => '35% prize',
        'wins 40%'                    => 'wins 35%',
        // Adult content strings
        'adult entertainment and NFT markets' => 'crypto gaming and DeFi ecosystems',
        'adult entertainment'         => 'crypto gaming',
        'Adult Entertainment'         => 'Crypto Gaming',
        'ADULT ENTERTAINMENT'         => 'CRYPTO GAMING',
        'adult content'               => 'creator content',
        'Adult Content'               => 'Creator Content',
        'adult games'                 => 'crypto games',
        'Adult Games'                 => 'Crypto Games',
        'adult game'                  => 'crypto game',
        'Adult Game'                  => 'Crypto Game',
        'adult crypto'                => 'crypto vote-to-earn',
        'Adult Crypto'                => 'Crypto Vote-to-Earn',
        // Chain corrections
        'Polygon blockchain'          => 'Base blockchain',
        'Polygon 2.0'                 => 'Base',
        'on Polygon'                  => 'on Base',
        'On Polygon'                  => 'On Base',
        ' Polygon '                   => ' Base ',
        // Signup bonus
        '100 TTS signup'              => '500 TTS signup',
        '100 TTS sign-up'             => '500 TTS sign-up',
        'receive 100 TTS'             => 'receive 500 TTS',
        'earn 100 TTS'                => 'earn 500 TTS',
        'get 100 TTS'                 => 'get 500 TTS',
        '100 TTS bonus'               => '500 TTS bonus',
        // Copyright year
        'Copyright© 2024'             => 'Copyright© 2026',
        'Copyright © 2024'            => 'Copyright © 2026',
        '© 2024 Temptation'           => '© 2026 Temptation',
        'copyright 2024'              => 'copyright 2026',
        // Telegram: broadcast channel → community chat
        'https://t.me/temptationtoken"' => 'https://t.me/TTSCommunityChat"',
        'http://t.me/temptationtoken"'  => 'https://t.me/TTSCommunityChat"',
        't.me/temptationtoken"'         => 't.me/TTSCommunityChat"',
    ];
}

function tts_fixer_step4_run() {
    global $wpdb;
    $log = [];

    try {
        // First run: count total Elementor pages and store for progress tracking
        if ( false === get_option( 'tts_fixer_el_total' ) ) {
            $total = (int) $wpdb->get_var(
                "SELECT COUNT(*) FROM {$wpdb->postmeta}
                 WHERE meta_key = '_elementor_data'
                   AND meta_value != ''
                   AND meta_value != 'null'"
            );
            update_option( 'tts_fixer_el_total', $total );
            update_option( 'tts_fixer_el_offset', 0 );
            $log[] = "ℹ️  Elementor total pages found: $total";

            if ( $total === 0 ) {
                $log[] = 'ℹ️  No Elementor pages — step complete';
                update_option( 'tts_fixer_step4_done', time() );
                tts_fixer_append_log( 4, $log );
                return;
            }
        }

        $total  = (int) get_option( 'tts_fixer_el_total', 0 );
        $offset = (int) get_option( 'tts_fixer_el_offset', 0 );

        if ( $offset >= $total ) {
            $log[] = "ℹ️  Already complete ($total pages processed)";
            update_option( 'tts_fixer_step4_done', time() );
            tts_fixer_append_log( 4, $log );
            return;
        }

        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT post_id, meta_value FROM {$wpdb->postmeta}
             WHERE meta_key = '_elementor_data'
               AND meta_value != ''
               AND meta_value != 'null'
             ORDER BY post_id ASC
             LIMIT %d OFFSET %d",
            TTS_FIXER_BATCH,
            $offset
        ) );

        $sr      = tts_fixer_el_map();
        $updated = 0;

        foreach ( $rows as $row ) {
            $orig = $row->meta_value;
            $new  = str_replace( array_keys( $sr ), array_values( $sr ), $orig );

            if ( $new !== $orig ) {
                $result = $wpdb->update(
                    $wpdb->postmeta,
                    [ 'meta_value' => $new ],
                    [ 'post_id' => $row->post_id, 'meta_key' => '_elementor_data' ],
                    [ '%s' ],
                    [ '%d', '%s' ]
                );
                if ( $result !== false ) {
                    delete_post_meta( $row->post_id, '_elementor_css' );
                    $updated++;
                    $log[] = "✅ Post {$row->post_id} updated";
                } else {
                    $log[] = "❌ Post {$row->post_id} DB error: " . $wpdb->last_error;
                }
            } else {
                $log[] = "— Post {$row->post_id}: no changes needed";
            }
        }

        $new_offset = $offset + count( $rows );
        update_option( 'tts_fixer_el_offset', $new_offset );
        $log[] = "ℹ️  Batch done: {$updated} updated. Progress: {$new_offset} / {$total}";

        if ( $new_offset >= $total ) {
            update_option( 'tts_fixer_step4_done', time() );
            $log[] = '✅ Elementor batch COMPLETE';
        }

    } catch ( \Throwable $e ) {
        $log[] = '❌ Exception: ' . $e->getMessage();
    }

    tts_fixer_append_log( 4, $log );
}

// ─────────────────────────────────────────────────────────────
// STEP 5 — Create /trust and /audit pages
// ─────────────────────────────────────────────────────────────
function tts_fixer_step5_run() {
    $log = [];
    try {

        $pages = [
            'trust' => [
                'title'       => 'Trust & Security',
                'rm_title'    => 'Trust & Security | Temptation Token ($TTS)',
                'rm_desc'     => 'Temptation Token security credentials: Solidproof audit, LP locked on Team.Finance, Gnosis Safe 2/2 multisig, Chainlink VRF. Verified on Base blockchain.',
                'content_fn'  => 'tts_fixer_trust_content',
            ],
            'audit' => [
                'title'       => 'Smart Contract Audit',
                'rm_title'    => 'Smart Contract Audit | Temptation Token ($TTS)',
                'rm_desc'     => 'Temptation Token ($TTS) smart contract audited by Solidproof. All critical and high findings resolved. Voting contract, token, and staking verified on Base blockchain.',
                'content_fn'  => 'tts_fixer_audit_content',
            ],
        ];

        foreach ( $pages as $slug => $cfg ) {
            $existing = get_page_by_path( $slug );
            if ( ! $existing ) {
                $post_id = wp_insert_post( [
                    'post_title'   => $cfg['title'],
                    'post_name'    => $slug,
                    'post_status'  => 'publish',
                    'post_type'    => 'page',
                    'post_content' => call_user_func( $cfg['content_fn'] ),
                ] );
                if ( $post_id && ! is_wp_error( $post_id ) ) {
                    update_post_meta( $post_id, 'rank_math_title',       $cfg['rm_title'] );
                    update_post_meta( $post_id, 'rank_math_description',  $cfg['rm_desc'] );
                    $log[] = "✅ Created /{$slug} page (ID {$post_id})";
                } else {
                    $err   = is_wp_error( $post_id ) ? $post_id->get_error_message() : 'unknown error';
                    $log[] = "❌ Failed to create /{$slug}: {$err}";
                }
            } else {
                $log[] = "ℹ️  /{$slug} already exists (ID {$existing->ID})";
            }
        }

    } catch ( \Throwable $e ) {
        $log[] = '❌ Exception: ' . $e->getMessage();
    }

    tts_fixer_append_log( 5, $log );
    update_option( 'tts_fixer_step5_done', time() );
}

// ─────────────────────────────────────────────────────────────
// STEP 6 — Flush rewrite rules + clear caches (run last)
// ─────────────────────────────────────────────────────────────
function tts_fixer_step6_run() {
    $log = [];
    try {

        flush_rewrite_rules( true );
        $log[] = '✅ Rewrite rules flushed (.htaccess updated)';

        if ( function_exists( 'wp_cache_flush' ) ) {
            wp_cache_flush();
            $log[] = '✅ Object cache flushed';
        }

        do_action( 'litespeed_purge_all' );
        $log[] = '✅ LiteSpeed purge triggered';

        if ( class_exists( '\Elementor\Plugin' ) ) {
            \Elementor\Plugin::$instance->files_manager->clear_cache();
            $log[] = '✅ Elementor CSS cache cleared';
        }

    } catch ( \Throwable $e ) {
        $log[] = '❌ Exception: ' . $e->getMessage();
    }

    tts_fixer_append_log( 6, $log );
    update_option( 'tts_fixer_step6_done', time() );
}

// ─────────────────────────────────────────────────────────────
// LOG HELPER
// ─────────────────────────────────────────────────────────────
function tts_fixer_append_log( $step, array $entries ) {
    $all          = get_option( 'tts_fixer_log', [] );
    $all[ $step ] = array_merge( $all[ $step ] ?? [], $entries );
    update_option( 'tts_fixer_log', $all );
}

// ─────────────────────────────────────────────────────────────
// ADMIN POST HANDLERS (one per step)
// ─────────────────────────────────────────────────────────────
function tts_fixer_register_post_handlers() {
    for ( $s = 1; $s <= 6; $s++ ) {
        $action = "tts_fixer_step{$s}";
        add_action( "admin_post_{$action}", function () use ( $s, $action ) {
            if ( ! current_user_can( 'manage_options' ) ) {
                wp_die( 'Unauthorized' );
            }
            check_admin_referer( $action );
            call_user_func( "tts_fixer_step{$s}_run" );
            wp_redirect( admin_url( 'tools.php?page=tts-fixer&ran=' . $s ) );
            exit;
        } );
    }
}
tts_fixer_register_post_handlers();

// ─────────────────────────────────────────────────────────────
// ADMIN PAGE UI
// ─────────────────────────────────────────────────────────────
function tts_fixer_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( 'Unauthorized' );
    }

    $el_total  = get_option( 'tts_fixer_el_total', false );
    $el_offset = (int) get_option( 'tts_fixer_el_offset', 0 );
    $el_done   = get_option( 'tts_fixer_step4_done' );

    if ( $el_total === false ) {
        $el_progress = 'not started';
    } elseif ( $el_done ) {
        $el_progress = (int) $el_total . ' / ' . (int) $el_total . ' pages ✅';
    } else {
        $el_progress = "{$el_offset} / {$el_total} pages";
    }

    $steps = [
        1 => 'Fast meta fixes — Rank Math (pages 52 + 538), blogname, tagline, media ID 98',
        2 => 'Media library alt text scan — remove adult/Polygon strings',
        3 => 'Post content SQL fix — native MySQL REPLACE (fast single query)',
        4 => "Elementor JSON search-replace — batched [{$el_progress}]",
        5 => 'Create /trust and /audit pages',
        6 => 'Flush rewrite rules + clear all caches (run last)',
    ];

    // Ran notice
    if ( ! empty( $_GET['ran'] ) ) {
        $ran = (int) $_GET['ran'];
        echo '<div class="notice notice-success is-dismissible"><p>Step ' . esc_html( $ran ) . ' complete. Check the log below.</p></div>';
    }

    echo '<div class="wrap">';
    echo '<h1>TTS Fixer — Batched Operations</h1>';
    echo '<p style="color:#555;max-width:700px">Run each step in order. <strong>Step 4</strong> processes <strong>' . TTS_FIXER_BATCH . ' Elementor pages per click</strong> — keep clicking until it shows complete. Steps 5 and 6 are fast. You can safely re-run any step.</p>';

    echo '<table class="widefat striped" style="max-width:860px;margin-top:20px">';
    echo '<thead><tr><th style="width:40px">#</th><th>Operation</th><th style="width:180px">Status</th><th style="width:160px">Action</th></tr></thead>';
    echo '<tbody>';

    for ( $n = 1; $n <= 6; $n++ ) {
        $done_ts  = get_option( "tts_fixer_step{$n}_done" );

        if ( $n === 4 && ! $el_done && $el_total !== false && $el_offset < (int) $el_total ) {
            // Still batching
            $status    = '<span style="color:#996800">⏳ In progress (' . $el_progress . ')</span>';
            $btn_label = 'Run next batch';
        } elseif ( $done_ts ) {
            $status    = '<span style="color:green">✅ Done ' . esc_html( date( 'M j H:i', (int) $done_ts ) ) . '</span>';
            $btn_label = 'Re-run';
        } else {
            $status    = '<span style="color:#888">Pending</span>';
            $btn_label = 'Run';
        }

        $nonce_action = "tts_fixer_step{$n}";
        $form = '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">'
              . wp_nonce_field( $nonce_action, '_wpnonce', true, false )
              . '<input type="hidden" name="action" value="' . esc_attr( $nonce_action ) . '">'
              . '<button type="submit" class="button button-primary">' . esc_html( $btn_label ) . '</button>'
              . '</form>';

        echo '<tr>';
        echo '<td><strong>' . $n . '</strong></td>';
        echo '<td>' . esc_html( $steps[ $n ] ) . '</td>';
        echo '<td>' . $status . '</td>';
        echo '<td>' . $form . '</td>';
        echo '</tr>';
    }

    echo '</tbody></table>';

    // Per-step log sections
    $all_logs = get_option( 'tts_fixer_log', [] );
    if ( $all_logs ) {
        echo '<h2 style="margin-top:36px">Operation Log</h2>';
        for ( $n = 1; $n <= 6; $n++ ) {
            if ( empty( $all_logs[ $n ] ) ) continue;
            echo '<h3>Step ' . $n . '</h3>';
            echo '<pre style="background:#f6f7f7;border:1px solid #ddd;padding:12px;'
               . 'overflow:auto;max-height:220px;font-size:12px;line-height:1.6">'
               . esc_html( implode( "\n", $all_logs[ $n ] ) )
               . '</pre>';
        }
    }

    echo '</div>'; // .wrap
}

// ─────────────────────────────────────────────────────────────
// PAGE CONTENT: /trust
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// PAGE CONTENT: /audit
// ─────────────────────────────────────────────────────────────
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
<tr style="border-bottom:1px solid #eee"><td style="padding:8px">TTSVotingV3b (Active)</td><td style="padding:8px;font-family:monospace;font-size:.8rem">0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6</td></tr>
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
<tr><td style="padding:8px">M-5</td><td style="padding:8px;color:#ffc107">Medium</td><td style="padding:8px">CEI pattern in vote()</td><td style="padding:8px;color:#0066cc">✅ Accepted (non-exploitable — TTS is standard ERC-20)</td></tr>
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
