<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){
 foreach(['elementor/elementor.php','essential-addons-for-elementor-lite/essential_adons_elementor.php'] as $plugin){$result=activate_plugin($plugin);if(is_wp_error($result))throw new RuntimeException($result->get_error_message());}
 echo "Activated Elementor and Essential Addons\n";exit;
}
if(!defined('ELEMENTOR_VERSION'))throw new RuntimeException('Elementor did not initialize');
$records=[];
foreach(['horizontal-tabs'=>['eael-tabs-horizontal',true,false],'vertical-tabs'=>['eael-tabs-vertical',true,false],'collapsed-tabs'=>['eael-tabs-horizontal',false,true]] as $slug=>$mode){
 [$layout,$active,$toggle]=$mode;$existing=get_page_by_path($slug);$id=wp_insert_post(['ID'=>$existing?$existing->ID:0,'post_type'=>'page','post_status'=>'publish','post_title'=>ucwords(str_replace('-',' ',$slug)),'post_name'=>$slug]);
 $items=[];foreach(['Planning','Design','Delivery'] as $i=>$title)$items[]=['_id'=>'aa1000'.$i,'eael_adv_tabs_tab_show_as_default'=>$active&&$i===0?'active-default':'inactive','eael_adv_tabs_tab_title'=>$title,'eael_adv_tabs_tab_title_html_tag'=>'span','eael_adv_tabs_text_type'=>'content','eael_adv_tabs_tab_content'=>'<p>'.$title.' editable workshop content.</p>','eael_adv_tabs_icon_type'=>'icon','eael_adv_tabs_tab_title_icon_new'=>['value'=>'fas fa-leaf','library'=>'fa-solid']];
 $widget=['id'=>'bb10001','elType'=>'widget','widgetType'=>'eael-adv-tabs','settings'=>['eael_adv_tab_layout'=>$layout,'eael_adv_tabs_default_active_tab'=>$active?'yes':'','eael_adv_tabs_toggle_tab'=>$toggle?'yes':'','eael_adv_tabs_icon_show'=>'yes','eael_adv_tabs_tab'=>$items],'elements'=>[]];
 $data=[['id'=>'cc10001','elType'=>'section','settings'=>['padding'=>['unit'=>'px','top'=>'24','right'=>'20','bottom'=>'24','left'=>'20','isLinked'=>false]],'elements'=>[['id'=>'dd10001','elType'=>'column','settings'=>['_column_size'=>100],'elements'=>[$widget]]]]];
 update_post_meta($id,'_elementor_edit_mode','builder');update_post_meta($id,'_elementor_version',ELEMENTOR_VERSION);update_post_meta($id,'_elementor_data',wp_slash(wp_json_encode($data)));update_post_meta($id,'_wp_page_template','elementor_header_footer');
 \Elementor\Core\Files\CSS\Post::create($id)->update();$records[]=['id'=>$id,'url'=>get_permalink($id),'layout'=>$layout,'autoActive'=>$active,'toggle'=>$toggle];
}
require_once __DIR__.'/seed-addons-gallery.php';$records[]=seed_addons_gallery($url);$records[]=seed_addons_gallery($url,'masonry');$records[]=seed_addons_gallery($url,'grid','layout_3');$records[]=seed_addons_gallery($url,'grid','layout_3',2);
flush_rewrite_rules();file_put_contents(dirname($root).'/addons-records.json',json_encode($records,JSON_PRETTY_PRINT));echo json_encode($records)."\n";
