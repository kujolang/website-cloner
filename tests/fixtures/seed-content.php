<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){
 copy(__DIR__.'/content-fields.php',$root.'/wp-content/mu-plugins/fixture-content.php');
 foreach(['advanced-custom-fields/acf.php','custom-post-type-ui/custom-post-type-ui.php'] as $plugin){$result=activate_plugin($plugin);if(is_wp_error($result))throw new RuntimeException($result->get_error_message());}
 echo "Activated ACF and CPT UI\n";exit;
}
if(!defined('ACF_VERSION')||!function_exists('cptui_create_custom_post_types'))throw new RuntimeException('Content plugins did not initialize');
update_option('cptui_post_types',['project'=>['name'=>'project','labels'=>[],'description'=>'','show_in_menu'=>'true','query_var'=>'true','hierarchical'=>'false','label'=>'Projects','singular_label'=>'Project','public'=>'true','publicly_queryable'=>'true','show_ui'=>'true','show_in_rest'=>'true','rest_base'=>'projects','has_archive'=>'true','has_archive_string'=>'work','rewrite'=>'true','rewrite_slug'=>'work','rewrite_withfront'=>'false','supports'=>['title','editor','thumbnail','excerpt','custom-fields'],'taxonomies'=>['discipline']]]);
update_option('cptui_taxonomies',['discipline'=>['name'=>'discipline','labels'=>[],'query_var'=>'true','label'=>'Disciplines','singular_label'=>'Discipline','public'=>'true','show_ui'=>'true','show_in_rest'=>'true','rest_base'=>'disciplines','hierarchical'=>'true','rewrite'=>'true','rewrite_slug'=>'disciplines','object_types'=>['project']]]);
cptui_create_custom_post_types();cptui_create_custom_taxonomies();
$term=term_exists('Furniture','discipline')?:wp_insert_term('Furniture','discipline',['slug'=>'furniture']);$records=[];
foreach(['studio-chair','reading-lamp'] as $index=>$slug){
 $existing=get_page_by_path($slug,OBJECT,'project');$id=wp_insert_post(['ID'=>$existing?$existing->ID:0,'post_type'=>'project','post_status'=>'publish','post_title'=>ucwords(str_replace('-',' ',$slug)),'post_name'=>$slug,'post_content'=>'<p>Designed and made in our independent studio. This body copy stays editable.</p>']);
 wp_set_object_terms($id,[(int)$term['term_id']],'discipline');
 update_field('field_fixture_summary',$index?'A warm reading light for quiet evenings.':'A comfortable chair built for everyday use.',$id);update_field('field_fixture_budget',$index?450:1200,$id);update_field('field_fixture_featured',$index===0,$id);update_field('field_fixture_link',['title'=>$index?'Ask about the lamp':'Ask about the chair','url'=>$url.'/contact/','target'=>''],$id);
 $records[]=['id'=>$id,'url'=>get_permalink($id)];
}
update_field('field_fixture_related',$records[1]['id'],$records[0]['id']);update_field('field_fixture_related',$records[0]['id'],$records[1]['id']);flush_rewrite_rules();
file_put_contents(dirname($root).'/content-records.json',json_encode(['acf'=>ACF_VERSION,'projects'=>$records,'term'=>$term],JSON_PRETTY_PRINT));echo json_encode($records)."\n";
