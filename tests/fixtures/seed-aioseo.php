<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('all-in-one-seo-pack/all_in_one_seo_pack.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated AIOSEO\n";exit;}
if(!function_exists('aioseo'))throw new RuntimeException('AIOSEO did not initialize');
$records=[];
foreach(['editorial-guide'=>false,'unlisted-guide'=>true] as $slug=>$noindex){
 $existing=get_page_by_path($slug);$id=wp_insert_post(['ID'=>$existing?$existing->ID:0,'post_type'=>'page','post_status'=>'publish','post_title'=>$noindex?'Unlisted guide':'Editorial guide','post_name'=>$slug,'post_content'=>'[aioseo_breadcrumbs]<h2>Our publishing guide</h2><p>Fixture content for testing metadata independently from visible headings.</p>']);
 $prefix=$noindex?'Unlisted':'Editorial';
 $seo=\AIOSEO\Plugin\Common\Models\Post::getPost($id);
 foreach(['title'=>$prefix.' search title','description'=>$prefix.' description for a local plugin compatibility fixture.','og_title'=>$prefix.' social title','og_description'=>$prefix.' social description.','twitter_title'=>$prefix.' card title','twitter_description'=>$prefix.' card description.','robots_default'=>false,'robots_noindex'=>$noindex,'twitter_use_og'=>false] as $key=>$value)$seo->$key=$value;
 $seo->save();if($seo->lastError)throw new RuntimeException($seo->lastError);
 $records[]=['id'=>$id,'url'=>get_permalink($id),'noindex'=>$noindex,'title'=>$prefix.' search title'];
}
flush_rewrite_rules();file_put_contents(dirname($root).'/seo-records.json',json_encode(['pages'=>$records],JSON_PRETTY_PRINT));echo json_encode(['version'=>aioseo()->version,'pages'=>$records],JSON_PRETTY_PRINT)."\n";
