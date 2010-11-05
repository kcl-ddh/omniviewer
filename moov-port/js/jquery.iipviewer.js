/*
* Author: Matteo Romanello
*/
// the object embedding the plugin
(function($){
	$.source = null;
	$.server = null;
	
	// Initialise various variables
	$.fn.initialise = function(options){
		$.debug = options.debug;
		$.source = "#";
		$.source += this.attr("id") ||  alert( 'No element ID given to IIP constructor' );
		
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
		$(this).log_info('plugin IIP initialised');
		$(this).load();
		}

	$.fn.calculateMinSizes = function(){
		var tx = $.max_width;
		var ty = $.max_height;
		var thumb = 100;
	
		var winWidth = $($.source).width();
		var winHeight = $($.source).height();
	
		if( winWidth>winHeight ){
		  // For panoramic images, use a large navigation window
		  if( tx > 2*ty ) thumb = winWidth / 2;
		  else thumb = winWidth / 4;
		}
		else thumb = winHeight / 4;
	
		var r = $.res;
		while( tx > thumb ){
		  tx = parseInt(tx / 2);
		  ty = parseInt(ty / 2);
		  // Make sure we don't set our navigation image too small!
		  if( --r == 1 ) break;
		}
		$.min_x = tx;
		$.min_y = ty;
	
		// Determine the resolution for this image view
		tx = $.max_width;
		ty = $.max_height;
		while( tx > winWidth && ty > winHeight ){
		  tx = parseInt(tx / 2);
		  ty = parseInt(ty / 2);
		  $.res--;
		}
		$.wid = tx;
		$.hei = ty;
		$.res--;
		return;
	}
	/*
	* Calls the IIPImage server
	*/
	$.fn.load = function(){
		var query_string = "&obj=IIP,1.0&obj=Max-size&obj=Tile-size&obj=Resolution-number";
		// issue the ajax query
		$.ajax({
		 url: $.server + "?" +"FIF=" + $.images[0].src + query_string,
		 success: function(data){
			var response = data || alert( "No response from server " + $.server );
			$(this).log_info(response);
			var tmp = response.split( "Max-size" );
			if(!tmp[1]) alert( "Unexpected response from server " + $.server );
			var size = tmp[1].split(" ");
	    	$.max_width = parseInt( size[0].substring(1,size[0].length) );
	    	$.max_height = parseInt( size[1] );
	    	tmp = response.split( "Tile-size" );
			size = tmp[1].split(" ");
			$.tileSize[0] = parseInt( size[0].substring(1,size[0].length) );
			$.tileSize[1] = parseInt( size[1] );
			tmp = response.split( "Resolution-number" );
			$.num_resolutions = parseInt( tmp[1].substring(1,tmp[1].length) );
			$.res = this.num_resolutions;
			$(this).createWindows();
			
		 },
		 error:function(){
		 	$(this).log_error("Unable to get image and tile sizes from server!");
		 },
		});
		return;
	}
	/*
	* Create our navigation window
    */
    $.fn.createNavigationWindow = function(){
    	$(this).log("called createNavigationWindow()");
    	
    	var navcontainer = $('<div id="navcontainer"></div>').css("width",$.min_x).css("height",10);
    	
    	var toolbar = $('<div id="navcontainer"></div>').css("width",$.min_x);
    	// attach dblclick event
    	
    	// Create our navigation div and inject it inside our frame
    	var navwin = $('<div id="navwin"></div>').css("width",$.min_x).css("height",$.min_y);
    	navwin.append(navcontainer);
    	
    	// Create our navigation image and inject inside the div we just created
    	var navimage = null;
    	
    	// Create our navigation zone and inject inside the navigation div
    	var zone = null;
    	
    	// Create our progress bar
    	var loadBarContainer = null;
    	
    	// Create our nav buttons
    	var navbuttons = null;
    }

	$.fn.createWindows = function(){
		$(this).log_info("createWindows called");
		var winWidth = $($.source).width();
		var winHeight = $($.source).height();
		
		// Calculate some sizes and create the navigation window
    	$(this).calculateMinSizes();
    	$(this).createNavigationWindow();
		
		return;
	}
	$.fn.log = function(msg){
		if($.debug){
			console.log(msg);
		}
		return;
	}
	// wrap
	$.fn.log_info = function(msg){
		if($.debug){
			console.info(msg);
		}
		return;
	}
	
	$.fn.log_error = function(msg){
		if($.debug){
			console.error(msg);
		}
		else{
			alert(msg);
		}
		return;
	}

	$.fn.IIP = function(options) {
		var defaults = {
			image : null
		};
		
		var options = $.extend(defaults, options);
		
    	return this.each(function() {
			$(this).initialise(options);
			return false;
    	});
 	};
})(jQuery);