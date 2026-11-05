<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('smart-slider-3/smart-slider-3.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated Smart Slider\n";exit;}
if(!class_exists('Nextend\SmartSlider3\Install\Install'))throw new RuntimeException('Smart Slider failed to initialize');
\Nextend\SmartSlider3\Install\Install::install();
$context=\Nextend\SmartSlider3\Application\ApplicationSmartSlider3::getInstance()->getApplicationTypeAdmin();
$model=new \Nextend\SmartSlider3\Application\Model\ModelSliders($context);
$id=$model->create(['title'=>'Local workshop scenes','type'=>'simple','width'=>1200,'height'=>600,'responsive-mode'=>'auto','responsiveLimitSlideWidth'=>1,'widget-arrow-enabled'=>1,'widgetarrow'=>'imageEmpty','widget-bullet-enabled'=>1,'widgetbullet'=>'transitionRectangle','autoplay'=>0]);
if(!$id)throw new RuntimeException('Slider creation failed');
$slides=new \Nextend\SmartSlider3\Application\Model\ModelSlides($context);$uploads=wp_upload_dir();$created=[];
foreach([[44,91,72],[65,86,125],[132,72,56]] as $i=>$color){$im=imagecreatetruecolor(1200,600);$bg=imagecolorallocate($im,...$color);imagefill($im,0,0,$bg);$ink=imagecolorallocate($im,240,230,210);imagefilledellipse($im,250+$i*200,300,300,300,$ink);$file='scene-'.$i.'.png';imagepng($im,$uploads['path'].'/'.$file);imagedestroy($im);$created[]=$slides->createQuickImage(['media'=>$uploads['url'].'/'.$file,'title'=>'Workshop scene '.($i+1),'description'=>'Locally generated fixture artwork','alt'=>'Abstract workshop scene '.($i+1)],$id);}
if(count(array_filter($created))!==3)throw new RuntimeException('Slide creation failed');
$home=get_post((int)get_option('page_on_front'));wp_update_post(['ID'=>$home->ID,'post_content'=>'[smartslider3 slider="'.$id.'"]'.$home->post_content]);update_option('cloner_fixture_slider_id',$id);flush_rewrite_rules();echo json_encode(['sliderId'=>$id,'slides'=>$created,'autoplay'=>false])."\n";
