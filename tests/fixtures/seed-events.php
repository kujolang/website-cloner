<?php
$root=$argv[1];$fixture_url=getenv('FIXTURE_URL')?:'http://127.0.0.1:9420';if(parse_url($fixture_url,PHP_URL_HOST)!=='127.0.0.1')throw new RuntimeException('Loopback fixture required');$_SERVER['HTTP_HOST']='127.0.0.1:'.(parse_url($fixture_url,PHP_URL_PORT)?:9420);require $root.'/wp-load.php';require_once ABSPATH.'wp-admin/includes/plugin.php';wp_set_current_user(1);
if($argv[2]==='activate'){$result=activate_plugin('the-events-calendar/the-events-calendar.php');if(is_wp_error($result))throw new RuntimeException($result->get_error_message());echo "Activated Events Calendar\n";exit;}
if(!function_exists('tribe_create_event'))throw new RuntimeException('Event plugin did not initialize');
foreach(get_posts(['post_type'=>['tribe_events','tribe_venue'],'post_status'=>'any','numberposts'=>-1]) as $post)wp_delete_post($post->ID,true);
update_option('timezone_string','America/New_York');
$venue=tribe_create_venue(['Venue'=>'Community Hall','Address'=>'15 Main Street','City'=>'Fixture Town','State'=>'Michigan','Country'=>'United States','Zip'=>'48000']);
$events=[];
foreach([['Evening Concert','2027-11-07 01:30:00','2027-11-07 02:30:00',false],['Winter Workshop','2027-12-31 00:00:00','2028-01-01 23:59:59',true]] as $item){
 $id=tribe_create_event(['post_title'=>$item[0],'post_status'=>'publish','post_content'=>'<p>Join our local community for an original fixture event. This is test content, with no ticket sales or bookings.</p>','EventStartDate'=>substr($item[1],0,10),'EventEndDate'=>substr($item[2],0,10),'EventStartTime'=>substr($item[1],11),'EventEndTime'=>substr($item[2],11),'EventAllDay'=>$item[3],'EventTimezone'=>'America/New_York','EventVenueID'=>$venue,'EventCost'=>'25','EventCurrencySymbol'=>'$']);
 if(!$id||is_wp_error($id))throw new RuntimeException('Could not seed event');if(!get_post_meta($id,'_EventStartDateUTC',true))throw new RuntimeException('Event UTC date was not created');$events[]=['id'=>$id,'url'=>get_permalink($id)];
}
flush_rewrite_rules();file_put_contents(dirname($root).'/event-records.json',json_encode(['events'=>$events,'venue'=>$venue],JSON_PRETTY_PRINT));echo json_encode(['events'=>$events,'venue'=>$venue],JSON_PRETTY_PRINT)."\n";
