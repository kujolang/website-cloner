<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){
 $result=activate_plugin('complianz-gdpr/complianz-gpdr.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated Complianz\n";exit;
}
if(!class_exists('cmplz_cookiebanner'))throw new RuntimeException('Complianz did not initialize');
cmplz_install_cookiebanner_table(true);
global $wpdb;if($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s',$wpdb->prefix.'cmplz_cookiebanners'))!==$wpdb->prefix.'cmplz_cookiebanners')throw new RuntimeException('Complianz banner table was not installed');
$options=get_option('cmplz_options',[]);
$options=array_merge($options,['regions'=>['eu'],'enable_cookie_banner'=>'yes','consent_for_anonymous_stats'=>'yes','compile_statistics'=>'no','uses_thirdparty_services'=>'no','uses_ad_cookies'=>'no','use_cdb_api'=>'no']);
update_option('cmplz_options',$options);update_option('cmplz_wizard_completed_once',true);
$banner=new cmplz_cookiebanner();$banner->title='Fixture consent';$banner->disable_cookiebanner=false;$banner->position='bottom-right';$banner->header='Privacy preferences';$banner->accept='Accept';$banner->deny='Reject';$banner->view_preferences='View preferences';$banner->save();if(!$banner->ID)throw new RuntimeException('Complianz banner was not persisted');$banner->enable_default();
$home=get_post((int)get_option('page_on_front'));if(!str_contains($home->post_content,'Privacy choices'))wp_update_post(['ID'=>$home->ID,'post_content'=>$home->post_content.'<section><h2>Privacy choices</h2><p>This isolated fixture uses no analytics, advertising, or external delivery service. Its banner exercises the installed consent controls.</p></section>']);
flush_rewrite_rules();echo json_encode(['bannerId'=>$banner->ID,'optionalTracking'=>false,'wizardCompleted'=>true])."\n";
