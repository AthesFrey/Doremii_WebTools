<?php
/**
 * Plugin Name: Doremii Theme Toggle Loader (MU)
 * Description: Enqueue global light/dark toggle assets from wp-content/uploads.
 */
add_action('wp_enqueue_scripts', function () {
  $uploads_url  = content_url('/uploads');                 // https://doremii.top/wp-content/uploads
  $uploads_path = WP_CONTENT_DIR . '/uploads';             // .../wp-content/uploads
$css_rel = '/doremii-theme-toggle.css';
  $js_rel  = '/doremii-theme-toggle.js';
$css_path = $uploads_path . $css_rel;
  $js_path  = $uploads_path . $js_rel;
$css_ver = file_exists($css_path) ? filemtime($css_path) : '1';
  $js_ver  = file_exists($js_path) ? filemtime($js_path) : '1';
wp_enqueue_style(
    'doremii-theme-toggle',
    $uploads_url . $css_rel,
    [],
    $css_ver
  );
wp_enqueue_script(
    'doremii-theme-toggle',
    $uploads_url . $js_rel,
    [],
    $js_ver,
    true
  );
}, 20);

