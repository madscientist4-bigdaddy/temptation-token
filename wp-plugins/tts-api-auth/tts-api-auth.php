<?php
/**
 * Plugin Name: TTS API Auth
 * Plugin URI:  https://temptationtoken.io
 * Description: Programmatic REST API access for Temptation Token automation. Bypasses Hostinger's Application Password block via custom X-TTS-API-Key header. Auto-patches homepage logo on activation.
 * Version:     1.1.1
 * Author:      Temptation Token
 * Requires at least: 5.8
 * Tested up to: 6.7
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ──────────────────────────────────────────────────────────────
// Activation: generate one-time setup token + auto-fix logo
// ──────────────────────────────────────────────────────────────

register_activation_hook( __FILE__, 'tts_api_activate' );
function tts_api_activate() {
    // Only mint a setup token when there is nothing to protect yet. Minting one while a
    // key already exists hands out a free, unauthenticated key-overwrite.
    if ( ! get_option( 'tts_api_key' ) && ! get_option( 'tts_api_setup_token' ) ) {
        update_option( 'tts_api_setup_token', bin2hex( random_bytes( 16 ) ) );
    }
    tts_api_apply_logo_fix();
    tts_api_retire_stale_setup_token();
}

// ──────────────────────────────────────────────────────────────
// 1.1.1 SECURITY: a setup token must not outlive setup
//
// The token is printed in a wp-admin notice and accepted by the PUBLIC /setup route,
// which used to update_option('tts_api_key', …) unconditionally — so a token that
// survived setup was a standing, unauthenticated takeover of every authed route
// (elementor, meta, css). On this install the token was still live with api_key_set
// = true, weeks after setup, and it had been pasted into a chat log.
//
// Setup being complete is provable from state: an api_key exists. When that is true the
// token has no remaining purpose, so retire it on every load rather than trusting the
// one code path that was supposed to delete it.
// ──────────────────────────────────────────────────────────────
add_action( 'plugins_loaded', 'tts_api_retire_stale_setup_token' );
function tts_api_retire_stale_setup_token() {
    if ( get_option( 'tts_api_key' ) && get_option( 'tts_api_setup_token' ) ) {
        delete_option( 'tts_api_setup_token' );
        update_option( 'tts_api_setup_token_retired', current_time( 'Y-m-d H:i:s' ) );
    }
}

// ──────────────────────────────────────────────────────────────
// Logo fix: inject CSS targeting the oversized hero logo
// Widget data-id="e7cd5ae" on page 52 (homepage)
// ──────────────────────────────────────────────────────────────

function tts_api_apply_logo_fix( $page_id = null ) {
    if ( ! $page_id ) {
        // Try WordPress front page setting first, fall back to known ID
        $page_id = (int) get_option( 'page_on_front' );
        if ( ! $page_id ) $page_id = 52;
    }

    // ── Approach 1: patch the Elementor widget's width setting directly ──
    $elementor_data_raw = get_post_meta( $page_id, '_elementor_data', true );
    if ( $elementor_data_raw ) {
        $data = is_string( $elementor_data_raw )
            ? json_decode( $elementor_data_raw, true )
            : $elementor_data_raw;

        if ( $data ) {
            $modified = false;
            tts_api_patch_widget( $data, 'e7cd5ae', $modified );
            if ( $modified ) {
                // Same guarded writer as the REST routes — this path wrote raw
                // wp_json_encode() output straight into meta, which unslashing then
                // destroyed. It is a widget-width tweak; it must not be able to blank a page.
                tts_api_write_elementor_data( $page_id, $data );
            }
        }
    }

    // ── Approach 2 (always): inject global Additional CSS as a safety net ──
    // This fires whether or not Elementor data was found.
    $existing = get_option( 'tts_api_logo_css', '' );
    $logo_css = "/* TTS Logo Fix v1 - applied " . current_time( 'Y-m-d' ) . " */\n"
              . ".elementor-element-e7cd5ae img,"
              . ".elementor-element-e7cd5ae .elementor-image-box-img img {"
              . " max-width:200px!important; width:200px!important; height:auto!important; }\n";

    if ( $existing !== $logo_css ) {
        // Append to Additional CSS (Customizer)
        $current_css = wp_get_custom_css();
        $marker      = '/* TTS Logo Fix v1';
        if ( strpos( $current_css, $marker ) === false ) {
            wp_update_custom_css_post( $current_css . "\n" . $logo_css );
        } else {
            // Replace existing TTS Logo Fix block
            $current_css = preg_replace(
                '/\/\* TTS Logo Fix v1.*?(?=\n\/\*|\z)/s',
                $logo_css,
                $current_css
            );
            wp_update_custom_css_post( $current_css );
        }
        update_option( 'tts_api_logo_css', $logo_css );
    }

    update_option( 'tts_api_logo_fix_applied', current_time( 'Y-m-d H:i:s' ) );
    do_action( 'litespeed_purge_all' );
    return true;
}

function tts_api_patch_widget( &$elements, $target_id, &$modified ) {
    if ( ! is_array( $elements ) ) return;
    foreach ( $elements as &$el ) {
        if ( ! is_array( $el ) ) continue;
        if ( isset( $el['id'] ) && $el['id'] === $target_id ) {
            if ( ! isset( $el['settings'] ) ) $el['settings'] = [];
            // Elementor Image widget: set explicit width
            $el['settings']['width']        = [ 'unit' => 'px', 'size' => 200 ];
            $el['settings']['width_tablet'] = [ 'unit' => 'px', 'size' => 180 ];
            $el['settings']['width_mobile'] = [ 'unit' => 'px', 'size' => 140 ];
            $modified = true;
            return;
        }
        if ( ! empty( $el['elements'] ) ) {
            tts_api_patch_widget( $el['elements'], $target_id, $modified );
            if ( $modified ) return;
        }
    }
}

// ──────────────────────────────────────────────────────────────
// Admin notice: setup token + status
// ──────────────────────────────────────────────────────────────

add_action( 'admin_notices', 'tts_api_admin_notice' );
function tts_api_admin_notice() {
    $setup_token = get_option( 'tts_api_setup_token' );
    $key_set     = (bool) get_option( 'tts_api_key' );
    $logo_fix    = get_option( 'tts_api_logo_fix_applied' );
    $site        = rtrim( home_url(), '/' );

    if ( $setup_token ) {
        $setup_url = $site . '/wp-json/tts/v1/setup';
        echo '<div class="notice notice-warning is-dismissible"><p>'
           . '<strong>TTS API Auth — One-time setup required.</strong><br>'
           . 'Setup token: <code>' . esc_html( $setup_token ) . '</code><br>'
           . 'Run this once to register your API key (replace <code>YOUR_KEY_HERE</code> with a secret of your choice):<br>'
           . '<code>curl -s -X POST "' . esc_url( $setup_url ) . '" '
           . '-H "Content-Type: application/json" '
           . '-d \'{"setup_token":"' . esc_js( $setup_token ) . '","api_key":"YOUR_KEY_HERE"}\''
           . '</code>'
           . '</p></div>';
    } elseif ( $key_set ) {
        $status_icon = '✅';
        $logo_note   = $logo_fix ? " | ✅ Logo fix applied {$logo_fix}" : ' | ⚠️ Logo fix pending';
        echo '<div class="notice notice-success is-dismissible"><p>'
           . "<strong>TTS API Auth</strong>: {$status_icon} Active. "
           . 'Endpoint: <code>' . esc_url( $site . '/wp-json/tts/v1/' ) . '</code>'
           . esc_html( $logo_note )
           . '</p></div>';
    }
}

// ──────────────────────────────────────────────────────────────
// Authentication: X-TTS-API-Key → administrator user
// ──────────────────────────────────────────────────────────────

add_filter( 'determine_current_user', 'tts_api_authenticate', 20 );
function tts_api_authenticate( $user_id ) {
    if ( $user_id ) return $user_id;                 // already authenticated
    $key = tts_api_get_key_header();
    if ( ! $key ) return $user_id;
    $stored = get_option( 'tts_api_key' );
    if ( ! $stored || ! hash_equals( (string) $stored, (string) $key ) ) return $user_id;
    $ids = get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] );
    return ! empty( $ids ) ? (int) $ids[0] : $user_id;
}

add_filter( 'rest_authentication_errors', 'tts_api_auth_errors', 99 );
function tts_api_auth_errors( $result ) {
    if ( is_wp_error( $result ) ) return $result;  // don't override existing error
    $key = tts_api_get_key_header();
    if ( ! $key ) return $result;                  // no key: let normal auth decide
    $stored = get_option( 'tts_api_key' );
    if ( $stored && hash_equals( (string) $stored, (string) $key ) ) {
        return true;                               // valid key → allow
    }
    return new WP_Error( 'tts_bad_key', 'Invalid X-TTS-API-Key.', [ 'status' => 401 ] );
}

function tts_api_get_key_header() {
    // Primary: PHP-CGI / Apache FastCGI rewrites HTTP_* headers
    if ( ! empty( $_SERVER['HTTP_X_TTS_API_KEY'] ) ) {
        return sanitize_text_field( $_SERVER['HTTP_X_TTS_API_KEY'] );
    }
    // Fallback: some Hostinger configs use getallheaders()
    if ( function_exists( 'getallheaders' ) ) {
        $h = array_change_key_case( getallheaders(), CASE_LOWER );
        if ( ! empty( $h['x-tts-api-key'] ) ) {
            return sanitize_text_field( $h['x-tts-api-key'] );
        }
    }
    return '';
}

// ──────────────────────────────────────────────────────────────
// REST routes: /wp-json/tts/v1/
// ──────────────────────────────────────────────────────────────

add_action( 'rest_api_init', 'tts_api_register_routes' );
function tts_api_register_routes() {

    // Setup (public — one-time token exchange)
    register_rest_route( 'tts/v1', '/setup', [
        'methods'             => [ 'GET', 'POST' ],
        'callback'            => 'tts_api_route_setup',
        'permission_callback' => '__return_true',
    ] );

    // Rotate the API key (auth required — proves possession of the CURRENT key).
    // Without this, a leaked key could only be replaced from wp-admin, which is exactly
    // the dependency that left a live setup token lying around for weeks.
    register_rest_route( 'tts/v1', '/rotate-key', [
        'methods'             => 'POST',
        'callback'            => 'tts_api_route_rotate_key',
        'permission_callback' => 'tts_api_can_manage',
    ] );

    // Status (auth required)
    register_rest_route( 'tts/v1', '/status', [
        'methods'             => 'GET',
        'callback'            => 'tts_api_route_status',
        'permission_callback' => 'tts_api_can_manage',
    ] );

    // Elementor data for a page (auth required)
    register_rest_route( 'tts/v1', '/elementor/(?P<page_id>\d+)', [
        'methods'             => [ 'GET', 'POST' ],
        'callback'            => 'tts_api_route_elementor',
        'permission_callback' => 'tts_api_can_manage',
        'args'                => [ 'page_id' => [ 'required' => true, 'type' => 'integer' ] ],
    ] );

    // Generic post meta (auth required)
    register_rest_route( 'tts/v1', '/meta/(?P<post_id>\d+)', [
        'methods'             => [ 'GET', 'POST' ],
        'callback'            => 'tts_api_route_meta',
        'permission_callback' => 'tts_api_can_manage',
        'args'                => [ 'post_id' => [ 'required' => true, 'type' => 'integer' ] ],
    ] );

    // Apply logo fix (auth required, idempotent)
    register_rest_route( 'tts/v1', '/fix-logo', [
        'methods'             => 'POST',
        'callback'            => 'tts_api_route_fix_logo',
        'permission_callback' => 'tts_api_can_manage',
    ] );

    // Additional CSS for a post (auth required)
    register_rest_route( 'tts/v1', '/css', [
        'methods'             => [ 'GET', 'POST' ],
        'callback'            => 'tts_api_route_css',
        'permission_callback' => 'tts_api_can_manage',
    ] );
}

function tts_api_can_manage() {
    return current_user_can( 'manage_options' );
}

// ── /setup ──────────────────────────────────────────────────

function tts_api_route_rotate_key( WP_REST_Request $req ) {
    $body    = $req->get_json_params() ?: [];
    $new_key = $req->get_param( 'api_key' ) ?: ( $body['api_key'] ?? '' );
    if ( ! $new_key || strlen( $new_key ) < 16 ) {
        return new WP_Error( 'key_too_short', 'api_key must be ≥ 16 characters.', [ 'status' => 400 ] );
    }
    if ( hash_equals( (string) get_option( 'tts_api_key' ), (string) $new_key ) ) {
        return new WP_Error( 'same_key', 'New key is identical to the current key.', [ 'status' => 400 ] );
    }
    update_option( 'tts_api_key', $new_key );
    delete_option( 'tts_api_setup_token' );
    update_option( 'tts_api_key_rotated', current_time( 'Y-m-d H:i:s' ) );
    return [ 'ok' => true, 'message' => 'API key rotated. Old key is now invalid.' ];
}

function tts_api_route_setup( WP_REST_Request $req ) {
    $setup_token = get_option( 'tts_api_setup_token' );

    if ( $req->get_method() === 'GET' ) {
        return [
            'setup_complete' => ! $setup_token,
            'api_key_set'    => (bool) get_option( 'tts_api_key' ),
            'endpoint'       => home_url( '/wp-json/tts/v1/' ),
        ];
    }

    // POST
    if ( ! $setup_token ) {
        return new WP_Error( 'already_setup', 'Setup already complete.', [ 'status' => 409 ] );
    }
    // Defence in depth: even holding a valid token, this route may not replace a key that
    // already exists. Setup registers a first key; it is not an unauthenticated rotate.
    // Rotation is /rotate-key, which requires the CURRENT key.
    if ( get_option( 'tts_api_key' ) ) {
        delete_option( 'tts_api_setup_token' );
        return new WP_Error( 'already_setup', 'An API key is already registered; setup token retired. Use /rotate-key with the current key.', [ 'status' => 409 ] );
    }
    $body     = $req->get_json_params() ?: [];
    $provided = $req->get_param( 'setup_token' ) ?: ( $body['setup_token'] ?? '' );
    $new_key  = $req->get_param( 'api_key' )     ?: ( $body['api_key']     ?? '' );

    if ( ! $provided || ! $new_key ) {
        return new WP_Error( 'missing_params', 'setup_token and api_key required.', [ 'status' => 400 ] );
    }
    if ( ! hash_equals( (string) $setup_token, (string) $provided ) ) {
        return new WP_Error( 'invalid_token', 'Invalid setup token.', [ 'status' => 403 ] );
    }
    if ( strlen( $new_key ) < 16 ) {
        return new WP_Error( 'key_too_short', 'api_key must be ≥ 16 characters.', [ 'status' => 400 ] );
    }

    update_option( 'tts_api_key', $new_key );
    delete_option( 'tts_api_setup_token' );

    return [ 'ok' => true, 'message' => 'API key registered. Setup token consumed.' ];
}

// ── /status ─────────────────────────────────────────────────

function tts_api_route_status() {
    $user = wp_get_current_user();
    return [
        'ok'         => true,
        'user'       => $user->user_login,
        'site'       => get_bloginfo( 'url' ),
        'logo_fix'   => get_option( 'tts_api_logo_fix_applied', 'not applied' ),
        'version'    => '1.1.0',
    ];
}

// ── _elementor_data: the ONLY sanctioned write path ──────────
//
// THE LANDMINE THIS REMOVES. update_post_meta() runs wp_unslash() on its value. Elementor
// stores its layout as a JSON string that is full of escaped quotes, so writing that JSON
// straight through strips every backslash and the stored value becomes unparseable. The
// page then renders BLANK. This is not theoretical: it blanked roughly a third of page 52
// on 2026-08-16.
//
// The old contract pushed the burden onto callers — "pre-slash your JSON before POSTing".
// That is a contract nobody remembers at 1am, and one forgetful caller silently destroys a
// page. So correctness now lives HERE, and no caller can get it wrong:
//
//   1. Accept EITHER raw JSON or a pre-slashed payload. Which one it is is unambiguous:
//      pre-slashed Elementor data does not parse as JSON at the top level, raw data does.
//      Old pre-slashing callers therefore keep working, and are not double-escaped.
//   2. REFUSE anything that is not valid JSON either way. A 400 is infinitely better than
//      a 200 that blanks the homepage.
//   3. wp_slash() before update_post_meta(), which is the actual fix.
//   4. Read the value back, and require that it still parses. If it does not, restore the
//      previous value and report failure — so a future WP change to slashing semantics
//      surfaces as a loud error instead of silent corruption.
//
// Returns true on success, or WP_Error.
function tts_api_write_elementor_data( $post_id, $incoming ) {
    if ( is_array( $incoming ) ) {
        $decoded = $incoming;
    } else {
        $s = (string) $incoming;
        // Prefer the raw reading; fall back to treating the payload as pre-slashed.
        $decoded = json_decode( $s, true );
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            $decoded = json_decode( stripslashes( $s ), true );
        }
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            return new WP_Error(
                'tts_bad_elementor_json',
                'elementor_data is not valid JSON, raw or pre-slashed — refusing to write. '
                . 'Storing it would render the page blank. (' . json_last_error_msg() . ')',
                [ 'status' => 400 ]
            );
        }
    }
    if ( ! is_array( $decoded ) ) {
        return new WP_Error(
            'tts_bad_elementor_shape',
            'elementor_data must decode to an array of Elementor elements.',
            [ 'status' => 400 ]
        );
    }

    $previous = get_post_meta( $post_id, '_elementor_data', true );
    $canonical = wp_json_encode( $decoded );
    if ( ! is_string( $canonical ) ) {
        return new WP_Error( 'tts_encode_failed', 'Could not re-encode elementor_data.', [ 'status' => 500 ] );
    }

    update_post_meta( $post_id, '_elementor_data', wp_slash( $canonical ) );

    // Verify what is actually STORED, not what we hoped to store. A 200 from
    // update_post_meta() says nothing about whether the value survived unslashing.
    $stored = get_post_meta( $post_id, '_elementor_data', true );
    json_decode( is_string( $stored ) ? $stored : '', true );
    if ( json_last_error() !== JSON_ERROR_NONE ) {
        // Roll back rather than leave the page broken.
        if ( $previous === '' || $previous === null ) {
            delete_post_meta( $post_id, '_elementor_data' );
        } else {
            update_post_meta( $post_id, '_elementor_data', wp_slash( $previous ) );
        }
        return new WP_Error(
            'tts_elementor_readback_failed',
            'Stored elementor_data did not parse on read-back; previous value restored.',
            [ 'status' => 500 ]
        );
    }

    delete_post_meta( $post_id, '_elementor_css' );
    if ( class_exists( '\Elementor\Plugin' ) ) {
        \Elementor\Plugin::$instance->files_manager->clear_cache();
    }
    return true;
}

// ── /elementor/{page_id} ─────────────────────────────────────

function tts_api_route_elementor( WP_REST_Request $req ) {
    $page_id = (int) $req->get_param( 'page_id' );
    $page    = get_post( $page_id );
    if ( ! $page ) {
        return new WP_Error( 'not_found', 'Post not found.', [ 'status' => 404 ] );
    }

    if ( $req->get_method() === 'GET' ) {
        return [
            'page_id'         => $page_id,
            'title'           => $page->post_title,
            'elementor_data'  => get_post_meta( $page_id, '_elementor_data', true ),
            'elementor_status'=> get_post_meta( $page_id, '_elementor_edit_mode', true ),
        ];
    }

    // POST: update
    $body = $req->get_json_params() ?: [];

    if ( isset( $body['elementor_data'] ) ) {
        $wrote = tts_api_write_elementor_data( $page_id, $body['elementor_data'] );
        if ( is_wp_error( $wrote ) ) {
            return $wrote; // fail loudly; nothing else in this request has run yet
        }
    }

    if ( ! empty( $body['post_title'] ) ) {
        wp_update_post( [ 'ID' => $page_id, 'post_title' => sanitize_text_field( $body['post_title'] ) ] );
    }
    if ( isset( $body['post_content'] ) ) {
        wp_update_post( [ 'ID' => $page_id, 'post_content' => wp_kses_post( $body['post_content'] ) ] );
    }

    do_action( 'litespeed_purge_post', $page_id );
    return [ 'ok' => true, 'page_id' => $page_id ];
}

// ── /meta/{post_id} ──────────────────────────────────────────

function tts_api_route_meta( WP_REST_Request $req ) {
    $post_id = (int) $req->get_param( 'post_id' );

    if ( $req->get_method() === 'GET' ) {
        $key = $req->get_param( 'key' );
        if ( $key ) {
            return [ 'value' => get_post_meta( $post_id, sanitize_key( $key ), true ) ];
        }
        return [ 'meta' => get_post_meta( $post_id ) ];
    }

    $body = $req->get_json_params() ?: [];
    foreach ( $body as $k => $v ) {
        $key = sanitize_key( $k );

        // The generic meta route is the back door into the same landmine: anyone can POST
        // _elementor_data here and bypass /elementor entirely. Route it through the guarded
        // writer so there is exactly ONE way to write this key.
        if ( '_elementor_data' === $key ) {
            $wrote = tts_api_write_elementor_data( $post_id, $v );
            if ( is_wp_error( $wrote ) ) {
                return $wrote;
            }
            continue;
        }

        // Every other meta value: slash strings on the way in, because update_post_meta()
        // unslashes unconditionally. Without this, ANY string containing a backslash — a
        // Windows path, a regex, a JSON blob in some other meta key — is silently corrupted.
        update_post_meta( $post_id, $key, is_string( $v ) ? wp_slash( $v ) : $v );
    }
    return [ 'ok' => true, 'post_id' => $post_id ];
}

// ── /fix-logo ────────────────────────────────────────────────

function tts_api_route_fix_logo( WP_REST_Request $req ) {
    $page_id = (int) ( $req->get_param( 'page_id' ) ?: 0 );
    tts_api_apply_logo_fix( $page_id ?: null );
    return [
        'ok'      => true,
        'applied' => get_option( 'tts_api_logo_fix_applied' ),
    ];
}

// ── /css ─────────────────────────────────────────────────────

function tts_api_route_css( WP_REST_Request $req ) {
    if ( $req->get_method() === 'GET' ) {
        return [ 'css' => wp_get_custom_css() ];
    }
    $body = $req->get_json_params() ?: [];
    if ( ! isset( $body['css'] ) ) {
        return new WP_Error( 'missing_css', 'css field required.', [ 'status' => 400 ] );
    }
    wp_update_custom_css_post( sanitize_textarea_field( $body['css'] ) );
    do_action( 'litespeed_purge_all' );
    return [ 'ok' => true ];
}
