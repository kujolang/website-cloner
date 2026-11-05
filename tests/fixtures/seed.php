<?php
$root=$argv[1];
define('WP_INSTALLING',true);
require $root.'/wp-load.php';
require_once ABSPATH.'wp-admin/includes/upgrade.php';
require_once ABSPATH.'wp-admin/includes/plugin.php';
$kind=getenv('FIXTURE_KIND');$title=getenv('FIXTURE_TITLE');$url=getenv('FIXTURE_URL');
$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);
wp_install($title,'fixture-admin','fixture@example.invalid',true,'',bin2hex(random_bytes(24)));
wp_set_current_user(1);
update_option('siteurl',$url);update_option('home',$url);update_option('blogdescription','Independent ideas, thoughtfully made.');
update_option('permalink_structure','/%postname%/');update_option('posts_per_page',10);switch_theme(getenv('FIXTURE_THEME'));
foreach(get_posts(['post_type'=>['post','page'],'post_status'=>'any','numberposts'=>-1]) as $post)wp_delete_post($post->ID,true);
$uploads=wp_upload_dir();wp_mkdir_p($uploads['path']);
$im=imagecreatetruecolor(1200,600);$bg=imagecolorallocate($im,219,231,221);imagefill($im,0,0,$bg);$ink=imagecolorallocate($im,34,77,65);imagefilledellipse($im,920,210,450,450,$ink);$accent=imagecolorallocate($im,219,151,93);imagefilledrectangle($im,100,170,610,410,$accent);imagepng($im,$uploads['path'].'/studio.png');imagedestroy($im);
$asset=$uploads['url'].'/studio.png';
$intro='We make useful things with care. Explore our independent studio, read our latest notes, and learn how thoughtful design supports everyday life.';
$home='<!-- wp:heading {"level":1} --><h1 class="wp-block-heading">Ideas for a slower, better everyday.</h1><!-- /wp:heading --><!-- wp:paragraph --><p>'.$intro.'</p><!-- /wp:paragraph --><!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="'.$asset.'" alt="Abstract studio composition in green and terracotta"/></figure><!-- /wp:image --><!-- wp:heading --><h2 class="wp-block-heading">Made with purpose</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Good work starts with listening. We combine clear ideas, careful materials, and a practical approach.</p><!-- /wp:paragraph -->';
$pages=['Home'=>$home,'About'=>'<h2>A small team with a clear purpose</h2><p>We are an independent practice focused on useful, durable work. Our approach is collaborative and our process is transparent.</p>','Services'=>'<h2>How we can help</h2><p>We offer planning, design, and hands-on workshops for teams and individuals.</p><ul><li>Thoughtful planning</li><li>Practical design</li><li>Small-group workshops</li></ul>','Contact'=>'<h2>Start a conversation</h2><p>Tell us what you are working on. This is a local testing fixture and does not collect submissions.</p>'];
if($kind==='brochure')$pages['Contact'].='<form class="wpcf7-form" action="/wp-admin/admin-ajax.php" method="post"><label>Your name <input name="your-name" required></label><label>Email <input type="email" name="your-email" required></label><label>Message <textarea name="your-message"></textarea></label><button type="submit">Send message</button></form><p>Demonstration form: server delivery is not configured.</p>';
$ids=[];foreach($pages as $name=>$content){$ids[$name]=wp_insert_post(['post_title'=>$name,'post_name'=>strtolower($name),'post_content'=>$content,'post_status'=>'publish','post_type'=>'page']);}
update_option('show_on_front','page');update_option('page_on_front',$ids['Home']);
if($kind==='elementor'){
 activate_plugin('elementor/elementor.php');
 $data=[['id'=>'abc1001','elType'=>'section','settings'=>['background_background'=>'classic','background_color'=>'#E6EEE8','padding'=>['unit'=>'px','top'=>'48','right'=>'36','bottom'=>'48','left'=>'36','isLinked'=>false]],'elements'=>[['id'=>'abc1002','elType'=>'column','settings'=>['_column_size'=>100],'elements'=>[['id'=>'abc1003','elType'=>'widget','widgetType'=>'heading','settings'=>['title'=>'Spaces for better ideas.','header_size'=>'h1'],'elements'=>[]],['id'=>'abc1004','elType'=>'widget','widgetType'=>'text-editor','settings'=>['editor'=>'<p>'.$intro.'</p>'],'elements'=>[]],['id'=>'abc1005','elType'=>'widget','widgetType'=>'image','settings'=>['image'=>['url'=>$asset,'id'=>''],'image_size'=>'full'],'elements'=>[]],['id'=>'abc1006','elType'=>'widget','widgetType'=>'button','settings'=>['text'=>'Explore our services','link'=>['url'=>$url.'/services/']],'elements'=>[]]]]]]];
 update_post_meta($ids['Home'],'_elementor_edit_mode','builder');update_post_meta($ids['Home'],'_elementor_version','3.32.4');update_post_meta($ids['Home'],'_elementor_data',wp_slash(wp_json_encode($data)));update_post_meta($ids['Home'],'_wp_page_template','elementor_header_footer');
}
$cat=wp_create_category('Field Notes');for($i=1;$i<=($kind==='blog'?30:2);$i++)wp_insert_post(['post_title'=>sprintf('Field note %02d: Making room for good work',$i),'post_name'=>sprintf('field-note-%02d',$i),'post_status'=>'publish','post_type'=>'post','post_date'=>sprintf('2025-%02d-%02d 12:00:00',1+(int)(($i-1)/10),1+(($i-1)%10)),'post_category'=>[$cat],'post_content'=>'<h2>Small observations, useful changes</h2><p>Field note '.$i.' explores how clear priorities and thoughtful details shape everyday work. Begin with one useful question, test your assumptions, and make time to review what changed.</p><p>Our studio journal shares practical lessons from independent creative work. Each article offers a starting point for your own experiments.</p><figure><img src="'.$asset.'" alt="Green and terracotta studio study" /></figure>']);
$menu=wp_create_nav_menu('Main navigation');foreach($ids as $name=>$id)wp_update_nav_menu_item($menu,0,['menu-item-title'=>$name,'menu-item-object'=>'page','menu-item-object-id'=>$id,'menu-item-type'=>'post_type','menu-item-status'=>'publish']);set_theme_mod('nav_menu_locations',['primary'=>$menu]);
flush_rewrite_rules();echo "Seeded $kind\n";
