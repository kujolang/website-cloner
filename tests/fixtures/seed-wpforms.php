<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('wpforms-lite/wpforms.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated WPForms Lite\n";exit;}
if(!function_exists('wpforms'))throw new RuntimeException('WPForms did not initialize');
foreach(get_posts(['post_type'=>'wpforms','posts_per_page'=>-1,'post_status'=>'any']) as $old)wp_delete_post($old->ID,true);
$fields=[
 1=>['id'=>'1','type'=>'name','format'=>'first-last','label'=>'Your name','required'=>'1','size'=>'medium'],
 2=>['id'=>'2','type'=>'email','label'=>'Email','required'=>'1','size'=>'medium','confirmation'=>'1'],
 3=>['id'=>'3','type'=>'checkbox','label'=>'Services','required'=>'1','choices'=>[1=>['label'=>'Planning','value'=>'planning'],2=>['label'=>'Design','value'=>'design']]],
 4=>['id'=>'4','type'=>'select','label'=>'Region','required'=>'1','placeholder'=>'Choose a region','choices'=>[1=>['label'=>'North','value'=>'north'],2=>['label'=>'South','value'=>'south']]],
 5=>['id'=>'5','type'=>'textarea','label'=>'Message','required'=>'1','size'=>'medium']
];
$data=['fields'=>$fields,'field_id'=>6,'settings'=>['form_title'=>'Community request','submit_text'=>'Send request','submit_text_processing'=>'Sending...','notification_enable'=>'0','antispam_v3'=>'0','ajax_submit'=>'1','confirmations'=>[1=>['type'=>'message','message'=>'Fixture request accepted.']]]];
$id=wpforms()->obj('form')->add('Community request',['post_content'=>wpforms_encode($data)]);if(!$id)throw new RuntimeException('Could not create WPForms form');$data['id']=$id;wpforms()->obj('form')->update($id,$data);
$page=get_page_by_path('request');$pageid=wp_insert_post(['ID'=>$page?$page->ID:0,'post_type'=>'page','post_status'=>'publish','post_title'=>'Community request','post_name'=>'request','post_content'=>'<h2>Send a request</h2><p>Local fixture only. No messages are delivered.</p>[wpforms id="'.$id.'"]']);flush_rewrite_rules();file_put_contents(dirname($root).'/form-records.json',json_encode(['forms'=>[['id'=>$id,'url'=>get_permalink($pageid)]]],JSON_PRETTY_PRINT));echo "Created WPForms fixture $id\n";
