<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('elementor/elementor.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated Elementor\n";exit;}
if(!defined('ELEMENTOR_VERSION'))throw new RuntimeException('Elementor did not initialize');
$records=[];
foreach(['components'=>'horizontal','vertical-components'=>'vertical'] as $slug=>$layout){
 $existing=get_page_by_path($slug);$id=wp_insert_post(['ID'=>$existing?$existing->ID:0,'post_type'=>'page','post_status'=>'publish','post_title'=>ucwords(str_replace('-',' ',$slug)),'post_name'=>$slug]);
 $widgets=[['id'=>'aa10001','elType'=>'widget','widgetType'=>'heading','settings'=>['title'=>'Explore our services','header_size'=>'h1'],'elements'=>[]]];
 foreach(['tabs','accordion','toggle'] as $i=>$type){
  $items=[];foreach(['Planning','Design','Delivery'] as $j=>$title)$items[]=['_id'=>'bb'.$i.'000'.$j,'tab_title'=>$title,'tab_content'=>'<p>'.$type.' '.$title.' content. <a href="'.$url.'/about/">Learn about our studio</a>.</p>'];
  $widgets[]=['id'=>'cc1000'.$i,'elType'=>'widget','widgetType'=>$type,'settings'=>['tabs'=>$items,'type'=>$layout],'elements'=>[]];
 }
 $data=[['id'=>'dd10001','elType'=>'section','settings'=>['padding'=>['unit'=>'px','top'=>'24','right'=>'20','bottom'=>'24','left'=>'20','isLinked'=>false]],'elements'=>[['id'=>'ee10001','elType'=>'column','settings'=>['_column_size'=>100],'elements'=>$widgets]]]];
 update_post_meta($id,'_elementor_edit_mode','builder');update_post_meta($id,'_elementor_version',ELEMENTOR_VERSION);update_post_meta($id,'_elementor_data',wp_slash(wp_json_encode($data)));update_post_meta($id,'_wp_page_template','elementor_header_footer');
 \Elementor\Core\Files\CSS\Post::create($id)->update();
 $records[]=['id'=>$id,'url'=>get_permalink($id),'layout'=>$layout,'widgets'=>['tabs','accordion','toggle']];
}
// Modern container-based widgets use real child containers, not legacy HTML panels.
foreach(['nested-components'=>'one','nested-multiple'=>'multiple'] as $slug=>$mode){
 $existing=get_page_by_path($slug);$id=wp_insert_post(['ID'=>$existing?$existing->ID:0,'post_type'=>'page','post_status'=>'publish','post_title'=>ucwords(str_replace('-',' ',$slug)),'post_name'=>$slug]);$widgets=[];
 foreach(['nested-tabs','nested-accordion'] as $i=>$type){
  $items=[];$children=[];foreach(['Overview','Details','Next steps'] as $j=>$title){
   $items[]=['_id'=>sprintf('aa%05x',$i*10+$j),$i?'item_title':'tab_title'=>$title];
   $children[]=['id'=>sprintf('bb%05x',$i*10+$j),'elType'=>'container','settings'=>['content_width'=>'full'],'elements'=>[['id'=>sprintf('cc%05x',$i*10+$j),'elType'=>'widget','widgetType'=>'text-editor','settings'=>['editor'=>'<p>'.$type.' '.$title.' editable content.</p>'],'elements'=>[]]]];
  }
  $widgets[]=['id'=>sprintf('dd%05x',$i),'elType'=>'widget','widgetType'=>$type,'settings'=>[$i?'items':'tabs'=>$items,'default_state'=>'expanded','max_items_expended'=>$mode],'elements'=>$children];
 }
 $data=[['id'=>'ee00001','elType'=>'container','settings'=>['content_width'=>'boxed'],'elements'=>$widgets]];
 update_post_meta($id,'_elementor_edit_mode','builder');update_post_meta($id,'_elementor_version',ELEMENTOR_VERSION);update_post_meta($id,'_elementor_data',wp_slash(wp_json_encode($data)));update_post_meta($id,'_wp_page_template','elementor_header_footer');
 \Elementor\Core\Files\CSS\Post::create($id)->update();$records[]=['id'=>$id,'url'=>get_permalink($id),'accordionMode'=>$mode,'widgets'=>['nested-tabs','nested-accordion']];
}
flush_rewrite_rules();file_put_contents(dirname($root).'/widget-records.json',json_encode(['version'=>ELEMENTOR_VERSION,'pages'=>$records],JSON_PRETTY_PRINT));echo json_encode($records)."\n";
