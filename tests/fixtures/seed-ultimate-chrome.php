<?php
// Owned loopback fixture only; add two targeted pages without replacing existing samples.
$root=$argv[1];$url=getenv('FIXTURE_URL');if(parse_url($url,PHP_URL_HOST)!=='127.0.0.1')throw new RuntimeException('Loopback fixture required');
$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';wp_set_current_user(1);
if(!defined('ELEMENTOR_VERSION'))throw new RuntimeException('Elementor is required');
$pages=[];foreach(['studio','workshop'] as $name){$slug='shared-'.$name;$old=get_page_by_path($slug);$id=wp_insert_post(['ID'=>$old?$old->ID:0,'post_type'=>'page','post_status'=>'publish','post_name'=>$slug,'post_title'=>ucfirst($name).' services','post_content'=>'<h2>Our '.esc_html($name).'</h2><p>Useful information about our '.esc_html($name).' stays editable as native content.</p><p><a href="'.$url.'/shared-'.($name==='studio'?'workshop':'studio').'/">Explore the other location</a></p>']);$pages[]=['id'=>$id,'url'=>get_permalink($id)];}
$menu=wp_get_nav_menu_object('Workshop navigation');if(!$menu)throw new RuntimeException('Seed the menu fixture first');
$templates=[];foreach(['header','footer'] as $kind){$slug='fixture-shared-'.$kind;$old=get_page_by_path($slug,OBJECT,'elementor-hf');$id=wp_insert_post(['ID'=>$old?$old->ID:0,'post_type'=>'elementor-hf','post_status'=>'publish','post_name'=>$slug,'post_title'=>'Fixture shared '.ucfirst($kind)]);
$widgets=$kind==='header'?[
 ['id'=>'cd11001','elType'=>'widget','widgetType'=>'heading','settings'=>['title'=>'Workshop Collective','header_size'=>'h2'],'elements'=>[]],
 ['id'=>'cd11002','elType'=>'widget','widgetType'=>'navigation-menu','settings'=>['menu'=>(string)$menu->term_id,'layout'=>'horizontal','dropdown'=>'tablet','link_redirect'=>'child','submenu_icon'=>'arrow'],'elements'=>[]]
]:[['id'=>'cd22001','elType'=>'widget','widgetType'=>'text-editor','settings'=>['editor'=>'<p>Shared workshop footer. Visit our studio and workshop.</p><p><a href="'.$url.'/contact/">Talk to our team</a></p>'],'elements'=>[]]];
$data=[['id'=>$kind==='header'?'cd11003':'cd22003','elType'=>'section','settings'=>['padding'=>['unit'=>'px','top'=>'24','right'=>'20','bottom'=>'24','left'=>'20','isLinked'=>false]],'elements'=>[['id'=>$kind==='header'?'cd11004':'cd22004','elType'=>'column','settings'=>['_column_size'=>100],'elements'=>$widgets]]]];
foreach(['_elementor_edit_mode'=>'builder','_elementor_version'=>ELEMENTOR_VERSION,'_wp_page_template'=>'default','ehf_template_type'=>'type_'.$kind,'ehf_target_include_locations'=>['rule'=>['specifics'],'specific'=>array_map(fn($p)=>'post-'.$p['id'],$pages)]] as $key=>$value)update_post_meta($id,$key,$value);
update_post_meta($id,'_elementor_data',wp_slash(wp_json_encode($data)));\Elementor\Core\Files\CSS\Post::create($id)->update();$templates[$kind]=$id;
}
flush_rewrite_rules();$result=['pages'=>$pages,'templates'=>$templates,'scope'=>'Actual plugin-managed chrome on two targeted pages; existing menu samples unchanged.'];file_put_contents(dirname($root).'/ultimate-chrome-records.json',json_encode($result,JSON_PRETTY_PRINT));echo json_encode($result)."\n";
