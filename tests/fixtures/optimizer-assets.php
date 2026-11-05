<?php
// Ordinary source assets exercise installed optimizer rewriting, no export markers.
add_action('wp_enqueue_scripts',function(){
 wp_enqueue_style('fixture-optimizer',content_url('/fixture-optimizer/fixture.css'),[], '1');
});
