<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){
 copy(__DIR__.'/optimizer-assets.php',$root.'/wp-content/mu-plugins/fixture-optimizer.php');
 $result=activate_plugin('litespeed-cache/litespeed-cache.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated LiteSpeed Cache\n";exit;
}
if(!class_exists('LiteSpeed\\Conf'))throw new RuntimeException('LiteSpeed Cache did not initialize');
\LiteSpeed\Conf::get_instance()->update_confs(['cache'=>false,'media-lazy'=>true,'optm-css_min'=>true,'optm-css_comb'=>true,'optm-html_min'=>true,'optm-js_defer'=>1]);
$dir=WP_CONTENT_DIR.'/fixture-optimizer';wp_mkdir_p($dir);
copy(ABSPATH.'wp-includes/fonts/dashicons.woff2',$dir.'/icons.woff2');$uploads=wp_upload_dir();copy($uploads['path'].'/studio.png',$dir.'/background.png');
file_put_contents($dir.'/fixture.css','@font-face{font-family:FixtureIcons;src:url(icons.woff2) format("woff2");font-display:block}.fixture-panel{padding:32px;border-radius:20px;background:#dbe7dd url(background.png) right center/contain no-repeat;min-height:240px}.fixture-icon:before{font-family:FixtureIcons;content:"\\f155";font-size:32px}.fixture-panel p{max-width:60%}.fixture-lazy{width:100%;height:280px;object-fit:cover;border-radius:20px}@media(max-width:600px){.fixture-panel{padding:20px;background-size:cover}.fixture-panel p{max-width:80%}.fixture-lazy{height:180px}}');
$home=get_post((int)get_option('page_on_front'));$content=$home->post_content;
if(!str_contains($content,'fixture-panel'))$content.='<section class="fixture-panel"><span class="fixture-icon" aria-hidden="true"></span><h2>Optimized assets, preserved design</h2><p>Combined styles retain relative background images and icon fonts.</p></section><section><h2>Below the fold</h2><img class="fixture-lazy" src="'.esc_url($uploads['url'].'/studio.png').'" width="1200" height="600" alt="Geometric studio illustration"></section><details><summary>Explore our process</summary><p>Start with a clear idea, make a prototype, then refine the details.</p></details>';
wp_update_post(['ID'=>$home->ID,'post_content'=>$content]);flush_rewrite_rules();echo json_encode(['plugin'=>\LiteSpeed\Core::VER,'lazyImages'=>true,'combinedCSS'=>true,'serverCache'=>false,'cloudServices'=>false])."\n";
