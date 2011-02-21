/*
* Author: Matteo Romanello
*/

// the object embedding the plugin
(function($){
	// Initialise various variables
	$.fn.initialise = function(options){
		$.base = $(this);
		$.base.data('ow').source = null;
		$.base.data('ow').server = null;
		$.debug = options.debug;
		$.base.data('ow').source = "#";
		$.base.data('ow').source += this.attr("id") ||  alert( 'No element ID given to IIP constructor' );
		$.base.data('ow').server = options.server || '/fcgi-bin/iipsrv.fcgi';
		
		$.base.data('ow').render = options.render || 'random';
		
		options.image || alert( 'Image location not set in IIP constructor options');
    	if(options.image instanceof Array){
    		$.base.data('ow').images = new Array(options.image.length);
			for( i=0; i<options.image.length;i++ ){
	    		$.base.data('ow').images[i] = { src:options.image[i], sds:"0,90" };
			}
    	}
    	else $.base.data('ow').images = [{ src:options.image, sds:"0,90"} ];
    	
    	$.base.data('ow').fileFormat = options.fileFormat;
    	console.info("Selected flavour: \"%s\"",$.base.data('ow').fileFormat);
    	
    	$.base.data('ow').credit = options.credit || null;
    	
    	$.base.data('ow').scale = options.scale || null;
    	
    	if( options.zoom == 0 ) $.base.data('ow').initialZoom = 0;
    	else $.base.data('ow').initialZoom = options.zoom || 1;
    	
    	$.base.data('ow').showNavButtons = true;
    	if( options.showNavButtons == false ) $.base.data('ow').showNavButtons = false;
    	
    	$.base.data('ow').showNavigation = true;
    	if( options.showNavigation == false ) $.base.data('ow').showNavigation = false;
    	
    	// If we want to assign a function for a click within the image
    	// - used for multispectral curve visualization, for example
    	$.base.data('ow').targetclick = options.targetclick || null;
    	/* global variables */
		$.base.data('ow').max_width = 0;
		$.base.data('ow').max_height = 0;
		$.base.data('ow').min_x = 0;
		$.base.data('ow').min_y = 0;
		$.base.data('ow').wid = 0;
		$.base.data('ow').hei = 0;
		$.base.data('ow').rgn_x = 0;
		$.base.data('ow').rgn_y = 0;
		$.rgn_w = $.base.data('ow').wid;
		$.rgn_h = $.base.data('ow').wid;
		$.base.data('ow').xfit = 0;
		$.base.data('ow').yfit = 0;
		$.base.data('ow').navpos = [0,0];
		$.base.data('ow').tileSize = [0,0];
		$.base.data('ow').num_resolutions = 0;
		$.base.data('ow').res = 0;
		
		$.refresher = null;
		// if zoomify
		if($.base.data('ow').fileFormat == "zoomify"){
			$.base.data('ow').tileCountUpToTier = new Array();
			$.base.data('ow').tierSizeInTiles = new Array();
			$.base.data('ow').tierImageSize = new Array();
		}
		// Number of tiles loaded
		$.base.data('ow').nTilesLoaded = 0;
		$.base.data('ow').nTilesToLoad = 0;
		// start djatoka add
		$.base.data('ow').max_zoom = 7;
		$.base.data('ow').top_left_x = 0;
		$.base.data('ow').top_left_y = 0;
		// end djatoka add
		console.info('plugin initialised @ element%s',$.base.data('ow').source);
		console.info($.fn.data);
		$($.base.data('ow').source).addClass("targetframe");
		
		// global variables (they do not vary from an instance to another)
		$.svc_val_fmt = "info:ofi/fmt:kev:mtx:jpeg2000";
		$.svc_id = "info:lanl-repo/svc/getRegion";
		$.openUrl = "";
		$.standardTileSize = 256;
		$.sds = "0,90";
		$.contrast = 1.0;
		$.opacity = 0;
		// end global variables
		$(this).load();
		}
		

	$.fn.calculateMinSizes = function(){
		var tx = $.base.data('ow').max_width;
		var ty = $.base.data('ow').max_height;
		var thumb = 100;
	
		var winWidth = $($.base.data('ow').source).width();
		var winHeight = $($.base.data('ow').source).height();
		console.log("minwidth=%i minheight=%i",winWidth,winHeight);
		if( winWidth>winHeight ){
		  // For panoramic images, use a large navigation window
		  if( tx > 2*ty ) thumb = winWidth / 2;
		  else thumb = winWidth / 4;
		}
		else thumb = winHeight / 4;
	
		var r = $.base.data('ow').res;
		while( tx > thumb ){
		  tx = parseInt(tx / 2);
		  ty = parseInt(ty / 2);
		  // Make sure we don't set our navigation image too small!
		  if( --r == 1 ) break;
		}
		$.base.data('ow').min_x = tx;
		$.base.data('ow').min_y = ty;
	
		// Determine the resolution for this image view
		tx = $.base.data('ow').max_width;
		ty = $.base.data('ow').max_height;
		while( tx > winWidth && ty > winHeight ){
		  tx = parseInt(tx / 2);
		  ty = parseInt(ty / 2);
		  $.base.data('ow').res--;
		}
		$.base.data('ow').wid = tx;
		$.base.data('ow').hei = ty;
		$.base.data('ow').res--;
		console.log("CalcMinSizes: wid=%i hei=%i",$.base.data('ow').wid,$.base.data('ow').hei);
		return;
	}
	/*
	* Calls an image server according to the specified settings
	*/
	$.fn.load = function(){
		/*
		* Calls the IIPImage server
		*/
		if($.base.data('ow').fileFormat == "iip"){
			var query_string = "&obj=IIP,1.0&obj=Max-size&obj=Tile-size&obj=Resolution-number";
			// issue the ajax query
			$.ajax({
			 url: $.base.data('ow').server + "?" +"FIF=" + $.base.data('ow').images[0].src + query_string,
			 success: function(data){
				var response = data || alert( "No response from server " + $.base.data('ow').server );
				console.info(response);
				var tmp = response.split( "Max-size" );
				if(!tmp[1]) alert( "Unexpected response from server " + $.base.data('ow').server );
				var size = tmp[1].split(" ");
				$.base.data('ow').max_width = parseInt( size[0].substring(1,size[0].length) );
				$.base.data('ow').max_height = parseInt( size[1] );
				tmp = response.split( "Tile-size" );
				size = tmp[1].split(" ");
				$.base.data('ow').tileSize[0] = parseInt( size[0].substring(1,size[0].length) );
				$.base.data('ow').tileSize[1] = parseInt( size[1] );
				tmp = response.split( "Resolution-number" );
				$.base.data('ow').num_resolutions = parseInt( tmp[1].substring(1,tmp[1].length) );
				$.base.data('ow').res = $.base.data('ow').num_resolutions;
				$(this).createWindows();
				
			 },
			 error:function(){
				$(this).log_error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		/*
		* Calls the Zoomify pseudo-server
		*/
		else if($.base.data('ow').fileFormat == "zoomify"){
			var query_string = "ImageProperties.xml";
			$.ajax({
			 url: $.base.data('ow').server + "/"+$.base.data('ow').images[0].src + "/"+ query_string,
			 success: function(data){
				$.base.data('ow').max_width = parseInt(0);
				$.base.data('ow').max_height = parseInt(1);
				$.base.data('ow').tileSize[0] = $.standardTileSize;
				$.base.data('ow').tileSize[1] = $.standardTileSize;
				$(data).find("IMAGE_PROPERTIES").each(function(){
					$.base.data('ow').max_width = parseInt($(this).attr("WIDTH"));
					$.base.data('ow').max_height = parseInt($(this).attr("HEIGHT"));
					$.base.data('ow').tileSize[0] = parseInt($(this).attr("TILESIZE"));
					$.base.data('ow').tileSize[1] = $.base.data('ow').tileSize[0];
				});
				var response = data || alert( "No response from server " + $.base.data('ow').server );
				$(this).initialiseZoomify();
				$(this).createWindows();
			 },
			 error:function(){
				$(this).log_error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		/*
		* Calls the Djatoka image server
		*/
		else if($.base.data('ow').fileFormat == "djatoka"){
			// MODIFY
			$.ajax({
			 url: $.base.data('ow').server + "?"+"url_ver=Z39.88-2004&rft_id=" + $.base.data('ow').images[0].src + "&svc_id=info:lanl-repo/svc/getMetadata",
			 success: function(data){
				var resp = data || alert("No response from server " + this.server);
				$.base.data('ow').max_width = parseInt(resp.width);
	            $.base.data('ow').max_height = parseInt(resp.height);
	            $.base.data('ow').tileSize[0] = 256;
		        $.base.data('ow').tileSize[1] = 256;
	            $.base.data('ow').num_resolutions = parseInt(resp.levels);
	            $.base.data('ow').res = $.base.data('ow').num_resolutions;
				$(this).createWindows();
			 },
			 error:function(){
				$(this).log_error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		return;
	}
	$.fn.initialiseZoomify = function(){
		var tiles = [2];
		var imageSize =  [2];
		tiles[0] = Math.ceil( $.base.data('ow').max_width / $.standardTileSize );
		tiles[1] = Math.ceil( $.base.data('ow').max_height / $.standardTileSize );
		imageSize[0] = $.base.data('ow').max_width;
		imageSize[1] = $.base.data('ow').max_height;
		
		$.base.data('ow').tierSizeInTiles.push(new Array(tiles[0],tiles[1]));
		$.base.data('ow').tierImageSize.push( imageSize );
		//console.log("d"+tiles);

		while (imageSize[0] > $.standardTileSize ||
		       imageSize[1] > $.standardTileSize ) {

		    imageSize[0] = Math.floor( imageSize[0]/ 2 );
			imageSize[1] = Math.floor( imageSize[1] / 2 );
			
			tiles[0] = Math.ceil( imageSize[0] / $.standardTileSize );        
			tiles[1] = Math.ceil( imageSize[1] / $.standardTileSize );
			//console.log("pre "+$.base.data('ow').tierSizeInTiles);
		    $.base.data('ow').tierSizeInTiles.push(new Array(tiles[0],tiles[1]));
		    //console.log("post "+$.base.data('ow').tierSizeInTiles);
		    $.base.data('ow').tierImageSize.push( imageSize );
		    //console.log($.base.data('ow').tierImageSize);
		}

		$.base.data('ow').tierSizeInTiles.reverse();
		$.base.data('ow').tierImageSize.reverse();
		$.numberOfTiers = $.base.data('ow').tierSizeInTiles.length;

		$.base.data('ow').tileCountUpToTier[0] = 0;      
		for (var i = 1; i < $.numberOfTiers; i++) {
			//console.log("$.base.data('ow').tierSizeInTiles tier=%i %i",i-1,$.base.data('ow').tierSizeInTiles[i-1][0]);
			var temp = $.base.data('ow').tierSizeInTiles[i-1][0] * $.base.data('ow').tierSizeInTiles[i-1][1] +
		        $.base.data('ow').tileCountUpToTier[i-1];
		    //console.log("tileCountUpToTier %i",temp);
		    $.base.data('ow').tileCountUpToTier.push(
		        temp
		        );
		    //console.log("$.base.data('ow').tileCountUpToTier tier=%i %i",i,temp);
		}
		$.base.data('ow').num_resolutions = $.numberOfTiers;
		$.base.data('ow').res = $.base.data('ow').num_resolutions;
	}
	/*
	* Create our navigation window
    */
    $.fn.createNavigationWindow = function(){
    	console.log("called createNavigationWindow()");
    	
    	var navcontainer = $('<div></div>').addClass("navcontainer").css("width",$.base.data('ow').min_x).css("height",10);
    	// we'll worry later about how to change the @title into a proper tooltip
    	var toolbar = $('<div></div>').addClass("toolbar").css("width",$.base.data('ow').min_x).attr("title",'* Drag to move. Double Click to show/hide navigation buttons');
    	navcontainer.append(toolbar);
    	if($.base.data('ow').showNavigation){
			// Create our navigation div and inject it inside our frame
			var navwin = $('<div></div>').addClass("navwin").css("width",$.base.data('ow').min_x).css("height",$.base.data('ow').min_y).css("position","relative");
			navcontainer.append(navwin);
			var src="";
			// Create our navigation image and inject inside the div we just created
			if($.base.data('ow').fileFormat == "iip")
				var src = $.base.data('ow').server + '?FIF=' + $.base.data('ow').images[0].src + '&SDS=' + $.base.data('ow').images[0].sds + '&CNT=1.0' +'&WID=' + $.base.data('ow').min_x + '&QLT=99&CVT=jpeg';
			 else if($.base.data('ow').fileFormat == "zoomify")
				src =  $.base.data('ow').server +"/"+ $.base.data('ow').images[0].src+"/TileGroup"+0+"/0-0-0.jpg";
			else if($.base.data('ow').fileFormat == "djatoka")
				src =  $.base.data('ow').server +  "?url_ver=Z39.88-2004&rft_id="
				            + $.base.data('ow').images[0].src + "&svc_id=" + $.svc_id
				            + "&svc_val_fmt=" + $.svc_val_fmt
				            + "&svc.format=image/jpeg&svc.scale=" + $.base.data('ow').min_x + "," + $.base.data('ow').min_y;
			
			var navimage = $('<img/>').addClass("navigation").attr("src",src);
			navwin.append(navimage);
			
			// Create our navigation zone and inject inside the navigation div
			var zone;
			if($.base.data('ow').fileFormat == "iip")
				zone = $('<div class="zone"></div>').css("width",$.base.data('ow').min_x/2).css("height",$.base.data('ow').min_y/2).css("opacity",0.4);
			else
				// TODO
				zone = $('<div class="zone"></div>').css("width",$.base.data('ow').min_x/2).css("height",$.base.data('ow').min_y/2).css("opacity",0.4);
			navwin.append(zone);
    	}
    	// Create our progress bar
    	var loadBarContainer = $('<div></div>').addClass("loadBarContainer").css("width",$.base.data('ow').min_x-2).css("height",10).append($('<div></div>').addClass("loadBar"));
    	
    	// Create our nav buttons
    	
    	var sl = $('<img/>').addClass("shiftLeft").attr("src","images/left.png");
    	var su = $('<img/>').addClass("shiftUp").attr("src","images/up.png");
    	var sr = $('<img/>').addClass("shiftRight").attr("src","images/right.png");
    	var br1 = $('<br/>');
    	var sd = $('<img/>').addClass("shiftDown").attr("src","images/down.png");
    	var br2 = $('<br/>');
    	var zi = $('<img/>').addClass("zoomIn").attr("src","images/zoomIn.png");
    	var zo = $('<img/>').addClass("zoomOut").attr("src","images/zoomOut.png");
    	var re = $('<img/>').addClass("reset").attr("src","images/reset.png");
    	//var navbuttons = new Array();
    	//navbuttons = [sl,su,sr,sd,br1,zi,zo,re];
    	
    	navbuttons = $("<div></div>").addClass("navbuttons").append(sl,su,sr,br1,sd,br2,zi,zo,re);
    	navcontainer.append(navbuttons);
    	navcontainer.append(loadBarContainer);
    	// and then snap it into the page
    	console.log($.base.data('ow').source);	
    	$($.base.data('ow').source).append(navcontainer);
    	// Hide our navigation buttons if requested
    	if( $.base.data('ow').showNavButtons == false ) {
    		// act accordingly
    		return;
    	};
    	
    	$($.base.data('ow').source+" "+'div.zone').draggable({
    						containment:$($.base.data('ow').source +" div.navwin")
    						,stop: function(event, ui) {
								$(this).scrollNavigation(event,ui);
							}
							,start:function(event, ui) {
								$.base.data('ow').navpos = [$($.base.data('ow').source+" "+'div.zone').position().left, $($.base.data('ow').source+" "+'div.zone').position().top-10];
							}
    	});
    	
    	
    	
    	navcontainer.draggable( {containment:$.base.data('ow').source, handle:"toolbar"} );
    	
    	// ADD EVENT BINDINGS TO NAV BUTTONS
    	$($.base.data('ow').source+' img.zoomIn').bind( 'click', $(this).zoomIn);
		$($.base.data('ow').source+' img.zoomOut').bind( 'click', $(this).zoomOut);
		$($.base.data('ow').source+' img.reset').bind( 'click', function(){
			window.location=window.location; 
		});
		$($.base.data('ow').source+' img.shiftLeft').bind( 'click', function(){
			$(this).scrollTo(-$.rgn_w/3,0); 
		});
		$($.base.data('ow').source+' img.shiftUp').bind( 'click', function(){
			$(this).scrollTo(0,-$.rgn_h/3); 
		});
		$($.base.data('ow').source+' img.shiftDown').bind( 'click', function(){
			$(this).scrollTo(0,$.rgn_h/3); 
		});
		$($.base.data('ow').source+' img.shiftRight').bind( 'click', function(){
			$(this).scrollTo($.rgn_w/3,0); 
		});
		
		$($.base.data('ow').source+' img.navigation').bind('mousewheel', $(this).zoom);
		
		$($.base.data('ow').source+" "+'div.zone').bind('mousewheel', $(this).zoom);
		
		// TODO for the time being I leave behind minor events bound to mousewheel and #zone.click
		$(window).trigger('ui-ready');
    }

	$.fn.refreshLoadBar=function() {

	    // Update the loaded tiles number, grow the loadbar size
	    var w = ($.base.data('ow').nTilesLoaded / $.base.data('ow').nTilesToLoad) * $.base.data('ow').min_x;
	    $($.base.data('ow').source+" "+"div.loadBar").css( 'width', w );

	    // Display the % in the progress bar
	    $($.base.data('ow').source+" "+'div.loadBar').html('loading&nbsp;:&nbsp;'+Math.round($.base.data('ow').nTilesLoaded/$.base.data('ow').nTilesToLoad*100) + '%' );
		
		$($.base.data('ow').source+" "+'div.loadBarContainer').fadeIn();
	    if( $($.base.data('ow').source+" "+'div.loadBarContainer').css( 'opacity') != 0.85 ){
	      $($.base.data('ow').source+" "+'div.loadBarContainer').css( 'opacity', 0.85 );
	    }

	    // If we're done with loading, fade out the load bar
	    if( $.base.data('ow').nTilesLoaded == $.base.data('ow').nTilesToLoad ){
	      // Fade out our progress bar and loading animation in a chain
	      $($.base.data('ow').source+" "+'div.target').css( 'cursor', 'move' );
	      $($.base.data('ow').source+" "+'div.loadBarContainer').fadeOut();
	    }

	  }
    
    $.fn.scrollNavigation = function(ev,ui){
   		console.log("called scroll navigation");
   		var xmove = 0;
		var ymove = 0;
	
		var zone_w = $($.base.data('ow').source+" "+'div.zone').width();
		var zone_h = $($.base.data('ow').source+" "+'div.zone').height();
		//console.log(ui.position);
		  xmove = ui.position.left;
		  ymove = ui.position.top-10;
		  if( (Math.abs(xmove-$.base.data('ow').navpos[0]) < 3) && (Math.abs(ymove-$.base.data('ow').navpos[1]) < 3) ) return;
	
		if( xmove > ($.base.data('ow').min_x - zone_w) ) xmove = $.base.data('ow').min_x - zone_w;
		if( ymove > ($.base.data('ow').min_y - zone_h) ) ymove = $.base.data('ow').min_y - zone_h;
		if( xmove < 0 ) xmove = 0;
		if( ymove < 0 ) ymove = 0;
	
		$.base.data('ow').rgn_x = Math.round(xmove * $.base.data('ow').wid / $.base.data('ow').min_x);
		$.base.data('ow').rgn_y = Math.round(ymove * $.base.data('ow').hei / $.base.data('ow').min_y);
	 
		$(this).requestImages();
		//if( e.event ) this.positionZone();
    }
    
    $.fn.scrollTo = function(dx,dy){
   		//console.log("called scroll navigation "+dx+" "+dy);
   		if( dx || dy ){
		  // To avoid unnecessary redrawing ...
		  if( (Math.abs(dx) < 3) && (Math.abs(dy) < 3) ) return;
		  $(this).checkBounds(dx,dy);
		  $(this).requestImages();
		  if($.base.data('ow').showNavigation)
		  $(this).positionZone();
		}
    }

	$.fn.zoom=function(event, delta, deltaX, deltaY){
		if(delta>0)
			$(this).zoomIn();
		else
			$(this).zoomOut();
	}
    
    $.fn.zoomIn = function(){
    	$(this).trigger("zoomIn");
   		if( ($.base.data('ow').wid <= ($.base.data('ow').max_width/2)) && ($.base.data('ow').hei <= ($.base.data('ow').max_height/2)) ){
		   $.base.data('ow').res++;
		   $.base.data('ow').wid = $.base.data('ow').max_width;
		   $.base.data('ow').hei = $.base.data('ow').max_height;
			if($.base.data('ow').fileFormat == "djatoka"){
		  		var iter = $.base.data('ow').num_resolutions;
			}
			else{
				var iter = $.base.data('ow').num_resolutions-1;
			}
		   for( var i=$.base.data('ow').res; i<iter; i++ ){
		 $.base.data('ow').wid = Math.floor($.base.data('ow').wid/2);
		 $.base.data('ow').hei = Math.floor($.base.data('ow').hei/2);
		   }
	 
		   if( $.base.data('ow').xfit == 1 ){
		 $.base.data('ow').rgn_x = $.base.data('ow').wid/2 - ($.rgn_w/2);
		   }
		   else if( $.base.data('ow').wid > $.rgn_w ) $.base.data('ow').rgn_x = 2*$.base.data('ow').rgn_x + $.rgn_w/2;
	 
		   if( $.base.data('ow').rgn_x > $.base.data('ow').wid ) $.base.data('ow').rgn_x = $.base.data('ow').wid - $.rgn_w;
		   if( $.base.data('ow').rgn_x < 0 ) $.base.data('ow').rgn_x = 0;
	 
		   if( $.base.data('ow').yfit == 1 ){
		 $.base.data('ow').rgn_y = $.base.data('ow').hei/2 - ($.rgn_h/2);
		   }
		   else if( $.base.data('ow').hei > $.rgn_h ) $.base.data('ow').rgn_y = $.base.data('ow').rgn_y*2 + $.rgn_h/2;
	 
		   if( $.base.data('ow').rgn_y > $.base.data('ow').hei ) $.base.data('ow').rgn_y = $.base.data('ow').hei - $.rgn_h;
		   if( $.base.data('ow').rgn_y < 0 ) $.base.data('ow').rgn_y = 0;
	 
		   $(this).requestImages();
		   if($.base.data('ow').showNavigation){
		   	$(this).positionZone();
		   	
		   }
		   if( $.base.data('ow').scale ) $(this).setScale();
	 
		 }
    }
    
    $.fn.checkBounds = function(dx,dy){
    	console.debug("checkBounds input: dx=%i dy=%i",dx,dy);
   		var x = $.base.data('ow').rgn_x + dx;
		var y = $.base.data('ow').rgn_y + dy;
		if( x > $.base.data('ow').wid - $.rgn_w ) x = $.base.data('ow').wid - $.rgn_w;
		if( y > $.base.data('ow').hei - $.rgn_h ) y = $.base.data('ow').hei - $.rgn_h;
		if( x < 0 ) x = 0;
		if( y < 0 ) y = 0;
		$.base.data('ow').rgn_x = x;
		$.base.data('ow').rgn_y = y;
		console.log("check bounds %i %i",$.base.data('ow').rgn_x,$.base.data('ow').rgn_y);
    }
	
	$.fn.zoomOut = function(){
		$(this).trigger("zoomOut");
   		console.log("called zoom out");
   		if( ($.base.data('ow').wid > $.rgn_w) || ($.base.data('ow').hei > $.rgn_h) ){
		  $.base.data('ow').res--;
		  $.base.data('ow').wid = $.base.data('ow').max_width;
		  $.base.data('ow').hei = $.base.data('ow').max_height;
			if($.base.data('ow').fileFormat == "djatoka"){
		  		var iter = $.base.data('ow').num_resolutions;
			}
			else{
				var iter = $.base.data('ow').num_resolutions-1;
			}
		  for( var i=$.base.data('ow').res; i<iter; i++ ){
		$.base.data('ow').wid = Math.floor($.base.data('ow').wid/2);
		$.base.data('ow').hei = Math.floor($.base.data('ow').hei/2);
		  }
	
		  $.base.data('ow').rgn_x = $.base.data('ow').rgn_x/2 - ($.rgn_w/4);
		  if( $.base.data('ow').rgn_x + $.rgn_w > $.base.data('ow').wid ) $.base.data('ow').rgn_x = $.base.data('ow').wid - $.rgn_w;
		  if( $.base.data('ow').rgn_x < 0 ){
		$.base.data('ow').xfit=1;
		$.base.data('ow').rgn_x = 0;
		  }
		  else $.base.data('ow').xfit = 0;
	
		  $.base.data('ow').rgn_y = $.base.data('ow').rgn_y/2 - ($.rgn_h/4);
		  if( $.base.data('ow').rgn_y + $.rgn_h > $.base.data('ow').hei ) $.base.data('ow').rgn_y = $.base.data('ow').hei - $.rgn_h;
		  if( $.base.data('ow').rgn_y < 0 ){
		$.base.data('ow').yfit=1;
		$.base.data('ow').rgn_y = 0;
		  }
		  else $.base.data('ow').yfit = 0;
	
		  $(this).requestImages();
		  $(this).positionZone();
		  //if( $.base.data('ow').scale ) this.setScale();
		}
    }
    
    $.fn.scroll = function(){
    	var xmove =  - $($.base.data('ow').source+" "+'div.target').position().left;
    	console.debug($($.base.data('ow').source+" "+'div.target').offset().left,$($.base.data('ow').source+" "+'div.target').position().left);
		var ymove =  - $($.base.data('ow').source+" "+'div.target').position().top;
		$(this).scrollTo( xmove, ymove );
    }
	
	$.fn.createWindows = function(){
		console.info("createWindows called");
		var winWidth = $($.base.data('ow').source).width();
		var winHeight = $($.base.data('ow').source).height();
		
		// Calculate some sizes and create the navigation window
    	$(this).calculateMinSizes();
    	$(this).createNavigationWindow();
    	
    	// Create our main window target div, add our events and inject inside the frame
    	var el = $('<div></div>').addClass("target").css("cursor","move");
    	$($.base.data('ow').source).append(el);
    	console.info($.base);
		$($.base.data('ow').source+" "+'div.target').draggable({scroll:true
									,stop: function(event, ui) {
											$(this).scroll();
											return;
									}
									,start:function(event, ui) {
											return;
									}
								});
							
		$($.base.data('ow').source+" "+'div.target').bind("drag",function(event,ui) {
  							//event.preventDefault();
  							console.log(ui.position);
  							var top = ui.position.top;
  							var left = ui.position.left;
  							var out;
  							// check X
  							if( $.base.data('ow').rgn_x - left < 0 ){
							   ui.position.left = $.base.data('ow').rgn_x;
							   out = true;
							 }
							 if( $.base.data('ow').wid > $.rgn_w ){
							   if( $.base.data('ow').rgn_x - left > $.base.data('ow').wid - $.rgn_w ){
								 ui.position.left = -($.base.data('ow').wid - $.rgn_w - $.base.data('ow').rgn_x);
								 out = true;
							   }
							 }
							 else{
							   ui.position.left = 0;
							   out = true;
							 }
  							
  							//check Y
  							if( ($.base.data('ow').rgn_y - ui.position.top) < 0 ){
							   ui.position.top = $.base.data('ow').rgn_y;
							   out = true;
							 }
							 if( $.base.data('ow').hei > $.rgn_h ){
							   if( $.base.data('ow').rgn_y - ui.position.top > $.base.data('ow').hei - $.rgn_h ){
								 ui.position.top = -($.base.data('ow').hei - $.rgn_h - $.base.data('ow').rgn_y);
								 out = true;
							   }
							 }
							 else{
							   ui.position.top = 0;
							   out = true;
							 }
						}
						
  					);
		$($.base.data('ow').source+" "+'div.target').bind('mousewheel', $(this).zoom);
		$.rgn_w = winWidth;
    	$.rgn_h = winHeight;
    	
    	$(this).reCenter();
    	
    	$(window).resize(function() {
 			window.location=window.location;
		});
    	
    	for(var i=0;i<$(this).initialZoom;i++) $(this).zoomIn();
    	$(window).trigger("owready");
   		$(this).zoomOut();
    	$(this).requestImages();
    	$(this).positionZone();
    	
		return;
	}
	
	/* 
   	*/
	$.fn.positionZone = function(){
   		console.log("called positionZone");
   		
   		var pleft = ($.base.data('ow').rgn_x/$.base.data('ow').wid) * ($.base.data('ow').min_x);
		if( pleft > $.base.data('ow').min_x ) pleft = $.base.data('ow').min_x;
		if( pleft < 0 ) pleft = 0;
	
		var ptop = ($.base.data('ow').rgn_y/$.base.data('ow').hei) * ($.base.data('ow').min_y);
		if( ptop > $.base.data('ow').min_y ) ptop = $.base.data('ow').min_y;
		if( ptop < 0 ) ptop = 0;
	
		var width = ($.rgn_w/$.base.data('ow').wid) * ($.base.data('ow').min_x);
		if( pleft+width > $.base.data('ow').min_x ) width = $.base.data('ow').min_x - pleft;
	
		var height = ($.rgn_h/$.base.data('ow').hei) * ($.base.data('ow').min_y);
		if( height+ptop > $.base.data('ow').min_y ) height = $.base.data('ow').min_y - ptop;
	
		if( width < $.base.data('ow').min_x ) $.base.data('ow').xfit = 0;
		else $.base.data('ow').xfit = 1;
		if( height < $.base.data('ow').min_y ) $.base.data('ow').yfit = 0;
		else $.base.data('ow').yfit = 1;
		if($.base.data('ow').showNavigation){
			var border = $($.base.data('ow').source+" "+'div.zone')[0].offsetHeight - $($.base.data('ow').source+" "+'div.zone')[0].clientHeight;
			$($.base.data('ow').source+" "+'div.zone').animate({
								"left":pleft,
								"top":ptop,
								"width": width - border/2,
								"height": height - border/2
								}, 500);
		}
	}
	
	/* 
   	*/
	$.fn.loadGrid = function(){
   		console.log("rgn_x",$.base.data('ow').rgn_x);
   		
   		 //var pos = $($.base.data('ow').source).getPosition();

		// Delete our old image mosaic
		$($.base.data('ow').source+" "+'div.target').children().remove();
		$($.base.data('ow').source+" "+'div.target').css("left",0).css("top",0);
		
		// Get the start points for our tiles
	   var startx = Math.floor( $.base.data('ow').rgn_x / $.base.data('ow').tileSize[0] );
	   var starty = Math.floor( $.base.data('ow').rgn_y / $.base.data('ow').tileSize[1] );
   	
	  // If our size is smaller than the display window, only get these tiles!
	  var len = $.rgn_w;
	  if( $.base.data('ow').wid < $.rgn_w ) len = $.base.data('ow').wid;
	  var endx =  Math.floor( (len + $.base.data('ow').rgn_x) / $.base.data('ow').tileSize[0]);
	  
	  len = $.rgn_h;
	  if( $.base.data('ow').hei < $.rgn_h ) len = $.base.data('ow').hei;
	  var endy = Math.floor( (len + $.base.data('ow').rgn_y) / $.base.data('ow').tileSize[1]);
	  
	  // Number of tiles is dependent on view width and height
	  var xtiles = Math.ceil($.base.data('ow').wid / $.base.data('ow').tileSize[0]);
	  var ytiles = Math.ceil($.base.data('ow').hei / $.base.data('ow').tileSize[1]);
	  
	  /* Calculate the offset from the tile top left that we want to display.
       Also Center the image if our viewable image is smaller than the window
	  */
	  var xoffset = Math.floor($.base.data('ow').rgn_x % $.base.data('ow').tileSize[0]);
	  if( $.base.data('ow').wid < $.rgn_w ) xoffset -=  ($.rgn_w - $.base.data('ow').wid)/2;
  
	  var yoffset = Math.floor($.base.data('ow').rgn_y % $.base.data('ow').tileSize[1]);
	  if( $.base.data('ow').hei < $.rgn_h ) yoffset -= ($.rgn_h - $.base.data('ow').hei)/2;
	  
	  //console.log("offset x %d and offset y %d",xoffset,yoffset);
	  //console.log("xtiles %d and ytiles %d",xtiles,ytiles);
  
	  var tile;
	  var i, j, k, n;
	  var left, top;
	  k = 0;
	  n = 0;
	  
	  var centerx = startx + Math.round((endx-startx)/2);
	  var centery = starty + Math.round((endy-starty)/2);
  
	  var map = new Array((endx-startx)*(endx-startx));
  
	  // Should put this into 
	  var ntiles=0;
	  for( j=starty; j<=endy; j++ ){
		for (i=startx;i<=endx; i++) {
  
			map[ntiles] = {};
			if( $.base.data('ow').render == 'spiral' ){
			  // Calculate the distance from the centre of the image
			  map[ntiles].n = Math.abs(centery-j)* Math.abs(centery-j) + Math.abs(centerx-i)*Math.abs(centerx-i);
			}
			// Otherwise do a random rendering
			else map[ntiles].n = Math.random();
		
			map[ntiles].x = i;
			map[ntiles].y = j;
			ntiles++;
		}
	  }
	  
	  //console.log(map);
	  
	  $.base.data('ow').nTilesLoaded = 0;
	  $.base.data('ow').nTilesToLoad = ntiles*$.base.data('ow').images.length;
	  
	  if($.base.data('ow').fileFormat == "iip")
	  		map.sort(function s(a,b){return a.n - b.n;});
	  else if($.base.data('ow').fileFormat == "djatoka"){
			 // djatoka mods 
			 map.sort(function (a,b){return a > b;});
			 var first = true;
			 var r = $.base.data('ow').num_resolutions - $.base.data('ow').res;
			 var f = $(this).getMultiplier(r, $.base.data('ow').tileSize[0]);
			 // end djatoka mods

	  }
	  
	  for( var m=0; m<ntiles; m++ ){
		var i = map[m].x;
		var j = map[m].y;
  
		// Sequential index of the tile in the tif image
		// this variable needs to be changed for zoomify support
		if($.base.data('ow').fileFormat == "iip")
			k = i + (j*xtiles);
		else if($.base.data('ow').fileFormat == "djatoka"){
			// djatoka mods 
			var djatoka_x = i * f;
			var djatoka_y = j * f;
			if (first) {
				  top_left_x = (djatoka_x + $(this).getMultiplier(r, xoffset-2));
				  top_left_y = (djatoka_y + $(this).getMultiplier(r, yoffset-2));
				  if (top_left_x < 0)
						top_left_x = 0;
				  if (top_left_y < 0)
						top_left_y = 0;
				  $(this).setOpenURL();
				  first = false;
			}
			// end djatoka mods

	  }
  
		// Iterate over the number of layers we have
		var n;
		if($.base.data('ow').fileFormat == "iip"||$.base.data('ow').fileFormat == "zoomify"){
			 for(n=0;n<$.base.data('ow').images.length;n++){
			   if($.base.data('ow').fileFormat == "iip")
				 tile = $("<img />").attr("class",'layer'+n).css("left",(i-startx)*$.base.data('ow').tileSize[0] - xoffset).css("top",(j-starty)*$.base.data('ow').tileSize[1] - yoffset);
			   else{
				 // TODO fix here
				 tile = $("<img />").attr("class",'layer'+n).css("left",(i-startx)*$.base.data('ow').tileSize[0] - xoffset).css("top",(j-starty)*$.base.data('ow').tileSize[1] - yoffset);
				 }
			   tile.bind("load",function(){$.base.data('ow').nTilesLoaded++;$(this).refreshLoadBar();})			
			   tile.bind("error",function(){return;})
	   
		   // We set the source at the end so that the 'load' function is properly fired
			   var src = "";
			   if($.base.data('ow').fileFormat == "iip")
				 src = $.base.data('ow').server+"?FIF="+$.base.data('ow').images[n].src+"&cnt="+$.contrast+"&sds="+$.base.data('ow').images[n].sds+"&jtl="+$.base.data('ow').res+"," + k;
			   else{
				 var tileIndex = i + j * $.base.data('ow').tierSizeInTiles[$.base.data('ow').res][0] + $.base.data('ow').tileCountUpToTier[$.base.data('ow').res];
				 tileIndex=parseInt(tileIndex/256);
				 
				 
				 src = $.base.data('ow').server+"/"+$.base.data('ow').images[n].src +"/"+"TileGroup"+tileIndex+"/"+$.base.data('ow').res+"-"+i+"-"+j+".jpg";
				 }
			   tile.attr( 'src', src );
			   $($.base.data('ow').source+" "+'div.target').append(tile);
			 }
			 
		   }
	  else if($.base.data('ow').fileFormat == "djatoka"){
		   if (djatoka_x < $.base.data('ow').max_width && djatoka_y < $.base.data('ow').max_height) {
			for(n=0;n<$.base.data('ow').images.length;n++){
	  
			 tile = $("<img />").attr("class",'layer'+n).css("left",(i-startx)*$.base.data('ow').tileSize[0] - xoffset).css("top",(j-starty)*$.base.data('ow').tileSize[1] - yoffset);
	  		 tile.bind("load",function(){$.base.data('ow').nTilesLoaded++;$(this).refreshLoadBar();})	
			 tile.bind("error",function(){})
			 
			 // djatoka mods
			 var src = $.base.data('ow').server + "?url_ver=Z39.88-2004&rft_id="
					 + $.base.data('ow').images[n].src + "&svc_id=" + $.svc_id
					 + "&svc_val_fmt=" + $.svc_val_fmt
					 + "&svc.format=image/jpeg&svc.level="
					 + $.base.data('ow').res + "&svc.rotate=0&svc.region="
					 + djatoka_y + "," + djatoka_x + ",256,256";
			 // end djatoka mods
			 
			 // We set the source at the end so that the 'load' function is properly fired
			 //var src = this.server+"?FIF="+this.images[n].src+"&cnt="+this.contrast+"&sds="+this.images[n].sds+"&jtl="+this.res+"," + k;
			 tile.attr( 'src', src );
			 $($.base.data('ow').source+" "+'div.target').append(tile);
		   }
		  } else 
			  $.base.data('ow').nTilesLoaded++;
		 }
	  }
  		/*
	  if($.base.data('ow').images.length > 1 ){
		var selector = 'img.layer'+(n-1);
		$$(selector).set( 'opacity', this.opacity );
	  }
	  */
	  
	  }
	
	/* 
   	*/
	$.fn.requestImages = function(){
   		// bypassed the refresher for the time being
		// Set our cursor
		$($.base.data('ow').source+" "+'div.target').css( 'cursor', 'wait' );
		// Load our image mosaic
		$(this).loadGrid();
		// bypassed the refresher for the time being
	}
	
	$.fn.getMultiplier = function(r, f) {
	    var m = f;
	    for (i = 0; i < r; i++) {
	        m = m * 2;
	    }
	    return m;
	}
	
	$.fn.setOpenURL=function() {
	    var w = $.rgn_w;
	    if ($.base.data('ow').wid < $.rgn_w)
	        w = $.base.data('ow').wid;
	    var h = $.rgn_h;
	    if ($.base.data('ow').hei < $.rgn_h)
	    h = $.base.data('ow').hei;
	    $.openUrl = $.base.data('ow').server + "?url_ver=Z39.88-2004&rft_id="
	        + $.base.data('ow').images[0].src + "&svc_id=" + $.svc_id + "&svc_val_fmt="
	        + $.svc_val_fmt
	        + "&svc.format=image/jpeg&svc.level=" + $.base.data('ow').res
	        + "&svc.rotate=0&svc.region=" + top_left_y + ","
	        + top_left_x + "," + h + "," + w;
	}
	
	/* Recenter the image view
   	*/
	$.fn.reCenter = function(){
		$.base.data('ow').rgn_x = ($.base.data('ow').wid-$.rgn_w)/2;
   		$.base.data('ow').rgn_y = ($.base.data('ow').hei-$.rgn_h)/2;
   		console.log("called reCenter %d %d",$.base.data('ow').rgn_x,$.base.data('ow').rgn_y);
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
	

	$.fn.OmniViewer = function(options) {
		var defaults = {
			image : null
		};
		
		var options = $.extend(defaults, options);
		
    	return this.each(function() {
    		var $this = $(this);
    		data = $this.data('ow');
    		console.log($this);
    		if ( ! data) {
			  $(this).data('ow', {});
			  console.log("data not initialised");
			}
			else{
				console.log("data initialised");
			}
			$(this).initialise(options);
			return false;
    	});
 	};
})(jQuery);

(function() {
	var f = function() {};
	var c = {
		info: f,
		log: f,
		assert: f,
		warn: f,
		error: f,
		dir: f,
		group: f,
		groupEnd: f
	};

	if(!window.console)
		window.console = c;
})();

(function() {
  var proxied = console.log;
  console.log = function() {
	if($.debug)
    return proxied.apply(this, arguments);
  };
})();

(function() {
  var proxied = console.info;
  console.info = function() {
	if($.debug)
    return proxied.apply(this, arguments);
  };
})();

(function() {
  var proxied = console.debug;
  console.debug = function() {
	if($.debug)
    return proxied.apply(this, arguments);
  };
})();
