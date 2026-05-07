<?php
/**
 * Plugin Name: TTS API Auth
 * Plugin URI:  https://temptationtoken.io
 * Description: Custom REST endpoint for Temptation Token WordPress management. Token-auth only — no Application Password needed.
 * Version:     1.0.0
 * Author:      Blockchain Entertainment LLC
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'TTS_API_SECRET', 'TTS2026Admin!' );

add_action( 'rest_api_init', function () {
    register_rest_route( 'tts/v1', '/update', [
        'methods'             => 'POST',
        'callback'            => 'tts_api_handle',
        'permission_callback' => 'tts_api_check_token',
    ] );
} );

function tts_api_check_token( WP_REST_Request $request ) {
    $token = $request->get_header( 'X-TTS-Token' );
    if ( $token !== TTS_API_SECRET ) {
        return new WP_Error( 'tts_unauthorized', 'Invalid or missing X-TTS-Token', [ 'status' => 401 ] );
    }
    return true;
}

function tts_api_handle( WP_REST_Request $request ) {
    $action  = sanitize_text_field( $request->get_param( 'action' ) );
    $id      = intval( $request->get_param( 'id' ) );
    $title   = sanitize_text_field( $request->get_param( 'title' ) );
    $slug    = sanitize_title( $request->get_param( 'slug' ) );
    $content = wp_kses_post( $request->get_param( 'content' ) );

    switch ( $action ) {

        // ── Create a new page ─────────────────────────────────────────────────
        case 'create_page':
            if ( empty( $title ) || empty( $slug ) || empty( $content ) ) {
                return new WP_Error( 'tts_missing', 'title, slug, and content are required', [ 'status' => 400 ] );
            }
            // Check if slug already exists
            $existing = get_page_by_path( $slug, OBJECT, 'page' );
            if ( $existing ) {
                // Update instead of creating a duplicate
                $post_id = wp_update_post( [
                    'ID'           => $existing->ID,
                    'post_title'   => $title,
                    'post_content' => $content,
                    'post_status'  => 'publish',
                ] );
                if ( is_wp_error( $post_id ) ) {
                    return new WP_Error( 'tts_update_failed', $post_id->get_error_message(), [ 'status' => 500 ] );
                }
                return [
                    'ok'       => true,
                    'action'   => 'updated_existing',
                    'id'       => $post_id,
                    'slug'     => $slug,
                    'url'      => get_permalink( $post_id ),
                ];
            }
            $post_id = wp_insert_post( [
                'post_title'   => $title,
                'post_name'    => $slug,
                'post_content' => $content,
                'post_status'  => 'publish',
                'post_type'    => 'page',
            ] );
            if ( is_wp_error( $post_id ) ) {
                return new WP_Error( 'tts_insert_failed', $post_id->get_error_message(), [ 'status' => 500 ] );
            }
            return [
                'ok'     => true,
                'action' => 'created',
                'id'     => $post_id,
                'slug'   => $slug,
                'url'    => get_permalink( $post_id ),
            ];

        // ── Update existing page content ──────────────────────────────────────
        case 'update_content':
            if ( ! $id || empty( $content ) ) {
                return new WP_Error( 'tts_missing', 'id and content are required', [ 'status' => 400 ] );
            }
            $result = wp_update_post( [
                'ID'           => $id,
                'post_content' => $content,
            ] );
            if ( is_wp_error( $result ) ) {
                return new WP_Error( 'tts_update_failed', $result->get_error_message(), [ 'status' => 500 ] );
            }
            return [
                'ok'     => true,
                'action' => 'content_updated',
                'id'     => $result,
                'url'    => get_permalink( $result ),
            ];

        // ── Update Rank Math (or any post meta) fields ────────────────────────
        case 'update_meta':
            if ( ! $id ) {
                return new WP_Error( 'tts_missing', 'id is required', [ 'status' => 400 ] );
            }
            $meta_input = $request->get_param( 'meta' );
            if ( ! is_array( $meta_input ) || empty( $meta_input ) ) {
                return new WP_Error( 'tts_missing', 'meta object is required', [ 'status' => 400 ] );
            }
            $allowed_meta = [
                'rank_math_title',
                'rank_math_description',
                'rank_math_focus_keyword',
                'rank_math_robots',
                'rank_math_canonical_url',
                '_yoast_wpseo_title',
                '_yoast_wpseo_metadesc',
            ];
            $updated = [];
            $skipped = [];
            foreach ( $meta_input as $key => $value ) {
                if ( in_array( $key, $allowed_meta, true ) ) {
                    update_post_meta( $id, $key, sanitize_text_field( $value ) );
                    $updated[] = $key;
                } else {
                    $skipped[] = $key;
                }
            }
            return [
                'ok'      => true,
                'action'  => 'meta_updated',
                'id'      => $id,
                'updated' => $updated,
                'skipped' => $skipped,
            ];

        // ── Update content + meta in one call ─────────────────────────────────
        case 'update_all':
            if ( ! $id ) {
                return new WP_Error( 'tts_missing', 'id is required', [ 'status' => 400 ] );
            }
            $result = [];
            if ( ! empty( $content ) ) {
                $r = wp_update_post( [ 'ID' => $id, 'post_content' => $content ] );
                $result['content'] = is_wp_error( $r ) ? 'failed: ' . $r->get_error_message() : 'updated';
            }
            $meta_input = $request->get_param( 'meta' );
            if ( is_array( $meta_input ) ) {
                $allowed_meta = [
                    'rank_math_title', 'rank_math_description', 'rank_math_focus_keyword',
                    'rank_math_robots', 'rank_math_canonical_url',
                ];
                foreach ( $meta_input as $key => $value ) {
                    if ( in_array( $key, $allowed_meta, true ) ) {
                        update_post_meta( $id, $key, sanitize_text_field( $value ) );
                    }
                }
                $result['meta'] = 'updated';
            }
            return [ 'ok' => true, 'action' => 'update_all', 'id' => $id, 'result' => $result ];

        default:
            return new WP_Error(
                'tts_unknown_action',
                'Unknown action. Valid: create_page, update_content, update_meta, update_all',
                [ 'status' => 400 ]
            );
    }
}
