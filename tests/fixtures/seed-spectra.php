<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('ultimate-addons-for-gutenberg/ultimate-addons-for-gutenberg.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated Spectra\n";exit;}
if(!WP_Block_Type_Registry::get_instance()->is_registered('uagb/faq'))throw new RuntimeException('Spectra FAQ did not register');
// inactiveOtherItems controls initial visibility; data-faqtoggle controls later clicks.
// The pinned PHP renderer defaults data-faqtoggle to true in all three cases.
$records=[];
foreach(['faq-exclusive'=>['accordion',true,true],'faq-multiple'=>['accordion',false,false],'faq-grid'=>['grid',false,false]] as $slug=>$mode){
 [$layout,$inactiveOthers,$first]=$mode;$id=str_replace('-','',$slug);
 $attributes=['block_id'=>$id,'layout'=>$layout,'inactiveOtherItems'=>$inactiveOthers,'expandFirstItem'=>$first,'enableSchemaSupport'=>true,'anchor'=>$slug];
 $content='<!-- wp:paragraph --><p>Useful answers from our independent studio.</p><!-- /wp:paragraph -->';
 $content.='<!-- wp:uagb/faq '.wp_json_encode($attributes).' -->';
 foreach(['How do we begin?'=>'Start with a useful question and a clear goal.','What happens next?'=>'Review the first draft and refine the details.'] as $question=>$answer){
  $index=$question==='How do we begin?'?1:2;$child=['block_id'=>$id.'item'.$index,'question'=>$question,'answer'=>$answer,'layout'=>$layout,'headingTag'=>'span','anchor'=>$slug.'-'.$index,'icon'=>'plus','iconActive'=>'minus'];
  $content.='<!-- wp:uagb/faq-child '.wp_json_encode($child).' /-->';
 }
 $content.='<!-- /wp:uagb/faq -->';
 $old=get_page_by_path($slug);$post=wp_insert_post(['ID'=>$old?$old->ID:0,'post_type'=>'page','post_status'=>'publish','post_name'=>$slug,'post_title'=>ucwords(str_replace('-',' ',$slug)),'post_content'=>$content]);
 $records[]=['url'=>get_permalink($post),'layout'=>$layout,'initialAllOpen'=>!$inactiveOthers,'first'=>$first];
}
flush_rewrite_rules();file_put_contents(dirname($root).'/spectra-records.json',json_encode($records,JSON_PRETTY_PRINT));echo json_encode($records)."\n";
