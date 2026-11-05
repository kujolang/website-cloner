<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');if($url!=='http://127.0.0.1:9439')throw new RuntimeException('Separate held-out loopback fixture required');$_SERVER['HTTP_HOST']='127.0.0.1:9439';require $root.'/wp-load.php';wp_set_current_user(1);
if(get_stylesheet()!=='twentytwentyfour'||!function_exists('wpforms'))throw new RuntimeException('Expected WPForms block-theme fixture');
$choices=[1=>['label'=>'Architecture','value'=>'architecture'],2=>['label'=>'Materials','value'=>'materials'],3=>['label'=>'Workshops','value'=>'workshops']];
$definitions=[
 'workshop-interest'=>['Workshop interest',[
 1=>['id'=>'1','type'=>'email','label'=>'Reply address','required'=>'1','confirmation'=>'1','size'=>'large'],
 2=>['id'=>'2','type'=>'select','label'=>'Primary interest','required'=>'1','style'=>'modern','placeholder'=>'Search interests','choices'=>$choices],
 3=>['id'=>'3','type'=>'select','label'=>'Additional interests','style'=>'modern','multiple'=>'1','choices'=>$choices],
 4=>['id'=>'4','type'=>'radio','label'=>'Visit format','required'=>'1','choices'=>[1=>['label'=>'In person','value'=>'in-person'],2=>['label'=>'Online','value'=>'online']]]]],
 'project-note'=>['Project note',[
 1=>['id'=>'1','type'=>'text','label'=>'Project title','required'=>'1','limit_enabled'=>'1','limit_count'=>40,'limit_mode'=>'characters'],
 2=>['id'=>'2','type'=>'text','label'=>'Reference code','input_mask'=>'AA-9999'],
 3=>['id'=>'3','type'=>'textarea','label'=>'Brief description','required'=>'1','limit_enabled'=>'1','limit_count'=>12,'limit_mode'=>'words'],
 4=>['id'=>'4','type'=>'checkbox','label'=>'Contact permission','required'=>'1','choices'=>[1=>['label'=>'I agree to be contacted','value'=>'yes']]]]]
];
foreach(array_keys($definitions) as $slug)if(get_page_by_path($slug))throw new RuntimeException('Held-out fixture is immutable after seeding');
$records=[];foreach($definitions as $slug=>$definition){$data=['fields'=>$definition[1],'field_id'=>5,'settings'=>['form_title'=>$definition[0],'submit_text'=>'Send request','submit_text_processing'=>'Sending...','notification_enable'=>'0','antispam_v3'=>'0','ajax_submit'=>'1','confirmations'=>[1=>['type'=>'message','message'=>'Fixture request accepted.']]]];$id=wpforms()->obj('form')->add($definition[0],['post_content'=>wpforms_encode($data)]);if(!$id)throw new RuntimeException('Unable to create fixture form');$data['id']=$id;wpforms()->obj('form')->update($id,$data);$page=wp_insert_post(['post_type'=>'page','post_status'=>'publish','post_title'=>$definition[0],'post_name'=>$slug,'post_content'=>'<!-- wp:paragraph --><p>Independent workshop fixture. No messages are delivered.</p><!-- /wp:paragraph --><!-- wp:shortcode -->[wpforms id="'.$id.'"]<!-- /wp:shortcode -->']);if(!$page)throw new RuntimeException('Unable to create fixture page');$records[]=['formId'=>$id,'pageId'=>$page,'url'=>get_permalink($page),'definition'=>$data];}
flush_rewrite_rules();file_put_contents(dirname($root).'/heldout-form-records.json',json_encode($records,JSON_PRETTY_PRINT));echo 'Seeded '.count($records)." independent forms\n";
