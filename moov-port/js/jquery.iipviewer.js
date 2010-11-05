var DEBUG = true;
// funciton to wrap firebug logging functionality and avoid errors when firebug's turned off
var log = function(msg){
	if(DEBUG){
		console.log(msg);
	}
};
// the object embedding the plugin
(function($){
	$.source = null;
	$.server = null;
	
	// Initialise various variables
	$.fn.initialise = function(options){
		$.source = this.attr("id") ||  alert( 'No element ID given to IIP constructor' );
		
		$.server = options.server || '/fcgi-bin/iipsrv.fcgi';
		
		$.render = options.render || 'random';
		
		options.image || alert( 'Image location not set in IIP constructor options');
    	if(options.image instanceof Array){
    		$.images = new Array(options.image.length);
			for( i=0; i<options.image.length;i++ ){
	    		$.images[i] = { src:options.image[i], sds:"0,90" };
			}
    	}
    	else $.images = [{ src:options.image, sds:"0,90"} ];
    	
    	$.credit = options.credit || null;
    	
    	$.scale = options.scale || null;
    	
    	if( options.zoom == 0 ) $.initialZoom = 0;
    	else $.initialZoom = options.zoom || 1;
    	
    	$.showNavButtons = true;
    	if( options.showNavButtons == false ) $.showNavButtons = false;
    	
    	// If we want to assign a function for a click within the image
    	// - used for multispectral curve visualization, for example
    	$.targetclick = options.targetclick || null;
    	/* global variables */
		$.max_width = 0;
		$.max_height = 0;
		$.min_x = 0;
		$.min_y = 0;
		$.sds = "0,90";
		$.contrast = 1.0;
		$.opacity = 0;
		$.wid = 0;
		$.hei = 0;
		$.rgn_x = 0;
		$.rgn_y = 0;
		$.rgn_w = $.wid;
		$.rgn_h = $.wid;
		$.xfit = 0;
		$.yfit = 0;
		$.navpos = [0,0];
		$.tileSize = [0,0];
		$.num_resolutions = 0;
		$.res;
		$.refresher = null;
		// Number of tiles loaded
		$.nTilesLoaded = 0;
		$.nTilesToLoad = 0;
		}

	$.fn.createWindows = function(value){
		/*var target_size = $(this.source).getSize();
    	var winWidth = target_size.x;
    	var winHeight = target_size.y;*/
		log('test create windows'+value);
	}

	$.fn.IIP = function(options) {
		var defaults = {
			image : null
		};
		
		var options = $.extend(defaults, options);
		
    	return this.each(function() {
			log('plugin IIP initialised');
			$(this).initialise(options);
			//$(this).createWindows(options.value);
			return false;
    	});
 	};
})(jQuery);