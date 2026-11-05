<?php
// Owned fixture: real ACF fields and ordinary theme rendering, no migration markers.
add_action('acf/init',function(){
 acf_add_local_field_group(['key'=>'group_fixture_project','title'=>'Project details','show_in_rest'=>1,'location'=>[[['param'=>'post_type','operator'=>'==','value'=>'project']]],'fields'=>[
  ['key'=>'field_fixture_summary','label'=>'Summary','name'=>'project_summary','type'=>'text'],
  ['key'=>'field_fixture_budget','label'=>'Budget','name'=>'project_budget','type'=>'number'],
  ['key'=>'field_fixture_featured','label'=>'Featured','name'=>'project_featured','type'=>'true_false'],
  ['key'=>'field_fixture_link','label'=>'Project link','name'=>'project_link','type'=>'link','return_format'=>'array'],
  ['key'=>'field_fixture_related','label'=>'Related project','name'=>'related_project','type'=>'post_object','post_type'=>['project'],'return_format'=>'id'],
 ]]);
});
add_filter('the_content',function($content){
 if(!is_singular('project')||!in_the_loop()||!is_main_query())return $content;
 $link=get_field('project_link');$out='<section class="project-facts"><p class="project-summary">'.esc_html(get_field('project_summary')).'</p><p>Budget: <span class="project-budget">'.esc_html((string)get_field('project_budget')).'</span></p><p class="project-featured">'.(get_field('project_featured')?'Featured project':'Standard project').'</p>';
 if(is_array($link))$out.='<p><a class="project-brief" href="'.esc_url($link['url']).'">'.esc_html($link['title']).'</a></p>';
 return $content.$out.'</section>';
});
add_action('wp_head',function(){echo '<style>.project-facts{padding:24px;border:1px solid currentColor;border-radius:12px}.project-summary{font-size:1.25em}.project-budget{font-variant-numeric:tabular-nums}</style>';});
