<?php
/**
 * Plugin Name: TTS API Auth
 * Plugin URI:  https://temptationtoken.io
 * Description: Programmatic REST API access for Temptation Token automation. Bypasses Hostinger's Application Password block via custom X-TTS-API-Key header. Auto-patches homepage logo on activation.
 * Version:     1.0.0
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
    if ( ! get_option( 'tts_api_setup_token' ) ) {
        update_option( 'tts_api_setup_token', bin2hex( random_bytes( 16 ) ) );
    }
    tts_api_apply_logo_fix();
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
                update_post_meta( $page_id, '_elementor_data', wp_json_encode( $data ) );
                delete_post_meta( $page_id, '_elementor_css' );
                if ( class_exists( '\Elementor\Plugin' ) ) {
                    \Elementor\Plugin::$instance->files_manager->clear_cache();
                }
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
        'version'    => '1.0.0',
    ];
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
        $raw = is_string( $body['elementor_data'] )
             ? $body['elementor_data']
             : wp_json_encode( $body['elementor_data'] );
        update_post_meta( $page_id, '_elementor_data', $raw );
        delete_post_meta( $page_id, '_elementor_css' );
        if ( class_exists( '\Elementor\Plugin' ) ) {
            \Elementor\Plugin::$instance->files_manager->clear_cache();
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
        update_post_meta( $post_id, sanitize_key( $k ), $v );
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
