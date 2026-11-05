<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('wordpress-seo/wp-seo.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated Yoast SEO\n";exit;}
if(!defined('WPSEO_VERSION'))throw new RuntimeException('Yoast SEO did not initialize');
$options=get_option('wpseo_titles',[]);$options['company_or_person']='company';$options['company_name']='Community Journal';$options['breadcrumbs-enable']=true;update_option('wpseo_titles',$options);
$records=[];
foreach(['editorial-guide'=>false,'unlisted-guide'=>true] as $slug=>$noindex){
 $existing=get_page_by_path($slug);$id=wp_insert_post(['ID'=>$existing?$existing->ID:0,'post_type'=>'page','post_status'=>'publish','post_title'=>$noindex?'Unlisted guide':'Editorial guide','post_name'=>$slug,'post_content'=>'[wpseo_breadcrumb]<h2>Our publishing guide</h2><p>Fixture content for testing metadata independently from visible headings.</p>']);
 $prefix=$noindex?'Unlisted':'Editorial';
 foreach(['title'=>$prefix.' search title','metadesc'=>$prefix.' description for a local plugin compatibility fixture.','opengraph-title'=>$prefix.' social title','opengraph-description'=>$prefix.' social description.','twitter-title'=>$prefix.' card title','twitter-description'=>$prefix.' card description.','meta-robots-noindex'=>$noindex?'1':'2'] as $key=>$value)update_post_meta($id,'_yoast_wpseo_'.$key,$value);
 $records[]=['id'=>$id,'url'=>get_permalink($id),'noindex'=>$noindex,'title'=>$prefix.' search title'];
}
flush_rewrite_rules();file_put_contents(dirname($root).'/seo-records.json',json_encode(['pages'=>$records],JSON_PRETTY_PRINT));echo json_encode(['version'=>WPSEO_VERSION,'pages'=>$records],JSON_PRETTY_PRINT)."\n";
