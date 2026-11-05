<?php
$root=$argv[1];$url=getenv('FIXTURE_URL');$_SERVER['HTTP_HOST']=parse_url($url,PHP_URL_HOST).':'.parse_url($url,PHP_URL_PORT);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('woocommerce/woocommerce.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated WooCommerce\n";exit;}
if(!class_exists('WC_Product'))throw new RuntimeException('WooCommerce did not initialize');
WC_Install::create_pages();update_option('woocommerce_currency','USD');update_option('woocommerce_price_num_decimals',2);update_option('woocommerce_store_address','Fixture only');
$term=term_exists('Workshop goods','product_cat')?:wp_insert_term('Workshop goods','product_cat',['slug'=>'workshop-goods']);$cat=(int)$term['term_id'];
require_once ABSPATH.'wp-admin/includes/image.php';
$images=[];$uploads=wp_upload_dir();
foreach(['front'=>[36,90,116],'detail'=>[161,77,48]] as $view=>$rgb){
 $file=$uploads['path'].'/workshop-'.$view.'.png';$asset=$uploads['url'].'/workshop-'.$view.'.png';$attachment=attachment_url_to_postid($asset);
 if(!$attachment){$im=imagecreatetruecolor(1200,1200);$bg=imagecolorallocate($im,232,235,229);imagefill($im,0,0,$bg);$ink=imagecolorallocate($im,...$rgb);imagefilledrectangle($im,240,170,960,1050,$ink);imagefilledellipse($im,600,200,280,180,$bg);imagepng($im,$file);imagedestroy($im);$attachment=wp_insert_attachment(['post_mime_type'=>'image/png','post_title'=>'Workshop '.$view,'post_status'=>'inherit'],$file);wp_update_attachment_metadata($attachment,wp_generate_attachment_metadata($attachment,$file));update_post_meta($attachment,'_wp_attachment_image_alt','Workshop shirt '.$view);}
 $images[]=$attachment;
}
$records=[];
foreach(['studio-mug'=>'simple','workshop-shirt'=>'variable'] as $slug=>$type){
 $existing=get_page_by_path($slug,OBJECT,'product');$p=$type==='simple'?new WC_Product_Simple($existing?$existing->ID:0):new WC_Product_Variable($existing?$existing->ID:0);
 $p->set_name(ucwords(str_replace('-',' ',$slug)));$p->set_slug($slug);$p->set_status('publish');$p->set_catalog_visibility('visible');$p->set_sku(strtoupper($slug));$p->set_description('<p>Made for everyday work. This product description should remain editable.</p>');$p->set_short_description('<p>A durable workshop essential.</p>');$p->set_category_ids([$cat]);$p->set_stock_status('instock');
 if($type==='simple'){$p->set_regular_price('24.00');$p->set_sale_price('19.00');}else{$a=new WC_Product_Attribute();$a->set_name('Size');$a->set_options(['Small','Large']);$a->set_visible(true);$a->set_variation(true);$p->set_attributes([$a]);}
 $p->set_image_id($images[0]);$p->set_gallery_image_ids([$images[1]]);$id=$p->save();
 if($type==='variable')foreach(['Small'=>'29.00','Large'=>'34.00'] as $size=>$price){$variation=new WC_Product_Variation(wc_get_product_id_by_sku('SHIRT-'.strtoupper($size))?:0);$variation->set_parent_id($id);$variation->set_status('publish');$variation->set_attributes(['size'=>$size]);$variation->set_regular_price($price);$variation->set_image_id($images[$size==='Small'?0:1]);$variation->set_sku('SHIRT-'.strtoupper($size));$variation->set_stock_status($size==='Small'?'instock':'outofstock');$variation->save();}
 if($type==='variable')WC_Product_Variable::sync($id);
 $records[]=['id'=>$id,'type'=>$type,'url'=>get_permalink($id)];
}
flush_rewrite_rules();file_put_contents(dirname($root).'/commerce-records.json',json_encode(['version'=>WC_VERSION,'products'=>$records],JSON_PRETTY_PRINT));echo json_encode($records)."\n";
