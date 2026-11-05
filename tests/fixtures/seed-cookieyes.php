<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('cookie-law-info/cookie-law-info.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated CookieYes\n";exit;}
\CookieYes\Lite\Includes\Activator::install();
$defaults=new \CookieYes\Lite\Admin\Modules\Settings\Includes\Settings();
if(!get_option('cky_settings'))$defaults->update($defaults->get_defaults());
do_action('admin_init');
$settings=get_option('cky_settings',[]);if(!$settings)throw new RuntimeException('CookieYes settings were not initialized');
$settings['consent_logs']['status']=false;$settings['account']['connected']=false;update_option('cky_settings',$settings);
flush_rewrite_rules();echo json_encode(['standalone'=>true,'tracking'=>false,'settingsInitialized'=>true])."\n";
