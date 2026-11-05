<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){
 copy(__DIR__.'/optimizer-assets.php',$root.'/wp-content/mu-plugins/fixture-optimizer.php');
 $result=activate_plugin('autoptimize/autoptimize.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated Autoptimize\n";exit;
}
if(!defined('AUTOPTIMIZE_PLUGIN_VERSION'))throw new RuntimeException('Autoptimize did not initialize');
$mode=getenv('FIXTURE_OPTIMIZER_MODE')?:'deferred';if(!in_array($mode,['deferred','inline'],true))throw new RuntimeException('Unknown optimizer fixture mode');
foreach(['autoptimize_html'=>'on','autoptimize_css'=>'on','autoptimize_css_aggregate'=>'on','autoptimize_css_include_inline'=>'on','autoptimize_css_defer'=>'on','autoptimize_css_defer_inline'=>'body{background:#d1e4dd;color:#28303d}','autoptimize_js'=>'on','autoptimize_js_aggregate'=>'on','autoptimize_cache_static'=>'on'] as $key=>$value)update_option($key,$value);
update_option('autoptimize_css_inline',$mode==='inline'?'on':'');update_option('autoptimize_css_defer',$mode==='deferred'?'on':'');update_option('autoptimize_js_aggregate',$mode==='deferred'?'on':'');update_option('autoptimize_js_defer_not_aggregate',$mode==='inline'?'on':'');
update_option('autoptimize_imgopt_settings',['autoptimize_imgopt_checkbox_field_3'=>'1','autoptimize_imgopt_number_field_7'=>1]);
$dir=WP_CONTENT_DIR.'/fixture-optimizer';wp_mkdir_p($dir);
copy(ABSPATH.'wp-includes/fonts/dashicons.woff2',$dir.'/icons.woff2');$uploads=wp_upload_dir();copy($uploads['path'].'/studio.png',$dir.'/background.png');
file_put_contents($dir.'/fixture.css','@font-face{font-family:FixtureIcons;src:url(icons.woff2) format("woff2");font-display:block}.fixture-panel{padding:32px;border-radius:20px;background:#dbe7dd url(background.png) right center/contain no-repeat;min-height:240px}.fixture-icon:before{font-family:FixtureIcons;content:"\\f155";font-size:32px}.fixture-panel p{max-width:60%}@media(max-width:600px){.fixture-panel{padding:20px;background-size:cover}.fixture-panel p{max-width:80%}}');
$home=get_post((int)get_option('page_on_front'));$content=$home->post_content;if(!str_contains($content,'fixture-panel'))$content.='<section class="fixture-panel"><span class="fixture-icon" aria-hidden="true"></span><h2>Optimized assets, preserved design</h2><p>Combined styles retain relative background images and icon fonts.</p></section><details><summary>Explore our process</summary><p>Start with a clear idea, make a prototype, then refine the details.</p></details>';
wp_update_post(['ID'=>$home->ID,'post_content'=>$content]);flush_rewrite_rules();echo json_encode(['autoptimize'=>AUTOPTIMIZE_PLUGIN_VERSION,'aggregatedCSS'=>true,'mode'=>$mode,'deferredCSS'=>$mode==='deferred','inlineCSS'=>$mode==='inline','lazyImages'=>true])."\n";
