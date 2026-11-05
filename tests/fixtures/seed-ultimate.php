<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){foreach(['elementor/elementor.php','header-footer-elementor/header-footer-elementor.php'] as $plugin){$result=activate_plugin($plugin);if(is_wp_error($result))throw new RuntimeException($result->get_error_message());}echo "Activated Elementor and Ultimate Addons\n";exit;}
if(!defined('ELEMENTOR_VERSION'))throw new RuntimeException('Elementor did not initialize');
$menu=wp_get_nav_menu_object('Workshop navigation');$menuId=$menu?$menu->term_id:wp_create_nav_menu('Workshop navigation');if(is_wp_error($menuId))throw new RuntimeException('Menu creation failed');
if(!wp_get_nav_menu_items($menuId)){
 wp_update_nav_menu_item($menuId,0,['menu-item-title'=>'Home','menu-item-url'=>$url.'/','menu-item-status'=>'publish']);
 $parent=wp_update_nav_menu_item($menuId,0,['menu-item-title'=>'Services','menu-item-url'=>$url.'/about/','menu-item-status'=>'publish']);
 foreach(['Planning'=>'about','Support'=>'contact'] as $title=>$slug)wp_update_nav_menu_item($menuId,0,['menu-item-title'=>$title,'menu-item-url'=>$url.'/'.$slug.'/','menu-item-parent-id'=>$parent,'menu-item-status'=>'publish']);
 wp_update_nav_menu_item($menuId,0,['menu-item-title'=>'Contact','menu-item-url'=>$url.'/contact/','menu-item-status'=>'publish']);
}
$records=[];
foreach(['horizontal','vertical','expandible'] as $layout){$slug='menu-'.$layout;$existing=get_page_by_path($slug);$id=wp_insert_post(['ID'=>$existing?$existing->ID:0,'post_type'=>'page','post_status'=>'publish','post_title'=>ucfirst($layout).' navigation','post_name'=>$slug]);
 $widgets=[['id'=>'ab11001','elType'=>'widget','widgetType'=>'navigation-menu','settings'=>['menu'=>(string)$menuId,'layout'=>$layout,'dropdown'=>'tablet','link_redirect'=>'child','hide_theme_icons'=>'yes','full_width_dropdown'=>'','submenu_icon'=>'arrow'],'elements'=>[]],['id'=>'ab11002','elType'=>'widget','widgetType'=>'text-editor','settings'=>['editor'=>'<p>Explore our workshop services and contact our team. This content stays editable.</p>'],'elements'=>[]]];
 $data=[['id'=>'ab11003','elType'=>'section','settings'=>['padding'=>['unit'=>'px','top'=>'24','right'=>'20','bottom'=>'24','left'=>'20','isLinked'=>false]],'elements'=>[['id'=>'ab11004','elType'=>'column','settings'=>['_column_size'=>100],'elements'=>$widgets]]]];
 update_post_meta($id,'_elementor_edit_mode','builder');update_post_meta($id,'_elementor_version',ELEMENTOR_VERSION);update_post_meta($id,'_elementor_data',wp_slash(wp_json_encode($data)));update_post_meta($id,'_wp_page_template','elementor_header_footer');\Elementor\Core\Files\CSS\Post::create($id)->update();$records[]=['id'=>$id,'url'=>get_permalink($id),'layout'=>$layout];
}
flush_rewrite_rules();file_put_contents(dirname($root).'/ultimate-records.json',json_encode($records,JSON_PRETTY_PRINT));echo json_encode($records)."\n";
