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
    	// we'll worry later about how to change the @title into a proper tooltip
    	var toolbar = $('<div id="toolbar"></div>').css("width",$.min_x).attr("title",'* Drag to move. Double Click to show/hide navigation buttons');
    	navcontainer.append(toolbar);
    	
    	// Create our navigation div and inject it inside our frame
    	var navwin = $('<div id="navwin"></div>').css("width",$.min_x).css("height",$.min_y);
    	navcontainer.append(navwin);
    	
    	// Create our navigation image and inject inside the div we just created
    	var src = $.server + '?FIF=' + $.images[0].src + '&SDS=' + $.images[0].sds + '&CNT=1.0' +'&WID=' + $.min_x + '&QLT=99&CVT=jpeg';
    	var navimage = $('<img id="navigation"/>').attr("src",src);
    	navwin.append(navimage);
    	
    	// Create our navigation zone and inject inside the navigation div
    	var zone = $('<div id="zone"></div>').css("width",$.min_x/2).css("height",$.min_y/2).css("opacity",0.4);
    	navwin.append(zone);
    	
    	// Create our progress bar
    	var loadBarContainer = $('<div id="loadBarContainer"></div>').css("width",$.min_x-2).css("height",10).append($('<div id="loadBar"></div>'));
    	
    	// Create our nav buttons
    	var navbuttons = $('<img id="shiftLeft" src="images/left.png"/><img id="shiftUp" src="images/up.png"/><img id="shiftRight" src="images/right.png"/><br/><img id="shiftDown" src="images/down.png"/><br/><img id="zoomIn" src="images/zoomIn.png"/><img id="zoomOut" src="images/zoomOut.png"/><img id="reset" src="images/reset.png"/>');
    	navbuttons = $("<div/>").attr("id","navbuttons").append(navbuttons);
    	navcontainer.append(navbuttons);
    	navcontainer.append(loadBarContainer);
    	// and then snap it into the page
    	$($.source).append(navcontainer);
    	// Hide our navigation buttons if requested
    	if( $.showNavButtons == false ) {
    		// act accordingly
    		return;
    	};
    	
    	$('#zone').draggable({
    						containment:"#navwin"
    						,stop: function(event, ui) {
								$(this).scrollNavigation();
							}
							,start:function(event, ui) {
								// let's see, we might have to use position() instead
								$.navpos = [$('#zone').position().left, $('#zone').position().top-10];
								//$(this).log($.navpos);
							}
    	});
    	
    	navcontainer.draggable( {containment:$.source, handle:"toolbar"} );
    	
    	// ADD EVENT BINDINGS TO NAV BUTTONS
    	$('#zoomIn').bind( 'click', $(this).zoomIn);
		$('#zoomOut').bind( 'click', $(this).zoomOut);
		$('#reset').bind( 'click', function(){
			window.location=window.location; 
		});
		$('#shiftLeft').bind( 'click', function(){
			$(this).scrollTo(-$.rgn_w/3,0); 
		});
		$('#shiftUp').bind( 'click', function(){
			$(this).scrollTo(-$.rgn_h/3,0); 
		});
		$('#shiftDown').bind( 'click', function(){
			$(this).scrollTo($.rgn_h/3,0); 
		});
		$('#shiftRight').bind( 'click', function(){
			$(this).scrollTo($.rgn_w/3,0); 
		});
		
		// TODO for the time being I leave behind minor events bound to mousewheel and #zone.click
    }
    
    $.fn.scrollNavigation = function(){
   		$(this).log("called scroll navigation");
    }
    
    $.fn.scrollTo = function(dx,dy){
   		$(this).log("called scroll navigation "+dx+" "+dy);
    }
    
    $.fn.zoomIn = function(){
   		$(this).log("called zoom in");
    }
	
	$.fn.zoomOut = function(){
   		$(this).log("called zoom out");
    }
	
	$.fn.createWindows = function(){
		$(this).log_info("createWindows called");
		var winWidth = $($.source).width();
		var winHeight = $($.source).height();
		
		// Calculate some sizes and create the navigation window
    	$(this).calculateMinSizes();
    	$(this).createNavigationWindow();
    	
    	// Create our main window target div, add our events and inject inside the frame
    	var el = $('<div id="target"></div>').css("cursor","move");
    	$($.source).append(el);
		$("#target" ).draggable({ containment: 'document'
									,scroll:false
									,stop: function(event, ui) {
											return;
									}
									,start:function(event, ui) {
											return;
									}
								});
		$.rgn_w = winWidth;
    	$.rgn_h = winHeight;
    	
    	$(this).reCenter();
    	
    	for(var i=0;i<$(this).initialZoom;i++) $(this).zoomIn();
   		$(this).zoomOut();
    	$(this).requestImages();
    	$(this).positionZone();
    	
		return;
	}
	
	/* 
   	*/
	$.fn.positionZone = function(){
   		$(this).log("called positionZone");
   		
   		var pleft = ($.rgn_x/$.wid) * ($.min_x);
		if( pleft > $.min_x ) pleft = $.min_x;
		if( pleft < 0 ) pleft = 0;
	
		var ptop = ($.rgn_y/$.hei) * ($.min_y);
		if( ptop > $.min_y ) ptop = $.min_y;
		if( ptop < 0 ) ptop = 0;
	
		var width = ($.rgn_w/$.wid) * ($.min_x);
		if( pleft+width > $.min_x ) width = $.min_x - pleft;
	
		var height = ($.rgn_h/$.hei) * ($.min_y);
		if( height+ptop > $.min_y ) height = $.min_y - ptop;
	
		if( width < $.min_x ) $.xfit = 0;
		else $.xfit = 1;
		if( height < $.min_y ) $.yfit = 0;
		else $.yfit = 1;
	
		// replace w/ $(window).width(), $(window).height()
		var border = $('zone').offsetHeight - $('zone').clientHeight;
	
		// Move the zone to the new size and position
		// replace w/ animate
		/*
		$('zone').morph({
		left: pleft,
		top: ptop + 10, // 10px for the toolbar
		width: width - border/2,
		height: height - border/2
		});*/
	}
	
	/* 
   	*/
	$.fn.loadGrid = function(){
   		$(this).log("called loadGrid()");
   		
   		
	}
	
	/* 
   	*/
	$.fn.requestImages = function(){
   		$(this).log("called requestImages");
	}
	
	/* Recenter the image view
   	*/
	$.fn.reCenter = function(){
		$.rgn_x = ($.wid-$.rgn_w)/2;
   		$.rgn_y = ($.hei-$.rgn_h)/2;
   		$(this).log("called reCenter "+$.rgn_x +" "+ $.rgn_y);
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