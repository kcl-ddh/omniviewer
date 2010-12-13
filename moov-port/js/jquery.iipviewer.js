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
    	
    	$.fileFormat = options.fileFormat;
    	console.log($.fileFormat);
    	
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
		$.standardTileSize = 256;
		$.refresher = null;
		// if zoomify
		if($.fileFormat == "zoomify"){
			$.tileCountUpToTier = new Array();
			$.tierSizeInTiles = new Array();
			$.tierImageSize = new Array();
		}
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
		if($.fileFormat == "tiff"){
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
				$.res = $.num_resolutions;
				$(this).createWindows();
				
			 },
			 error:function(){
				$(this).log_error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		else{
			var query_string = "ImageProperties.xml";
			$.ajax({
			 url: $.server + "/"+$.images[0].src + "/"+ query_string,
			 success: function(data){
				$.max_width = parseInt(0);
				$.max_height = parseInt(1);
				$.tileSize[0] = $.standardTileSize;
				$.tileSize[1] = $.standardTileSize;
				$(data).find("IMAGE_PROPERTIES").each(function(){
					$.max_width = parseInt($(this).attr("WIDTH"));
					$.max_height = parseInt($(this).attr("HEIGHT"));
					$.tileSize[0] = parseInt($(this).attr("TILESIZE"));
					$.tileSize[1] = $.tileSize[0];
				});
				var response = data || alert( "No response from server " + $.server );
				$(this).initialiseZoomify();
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
		//var imageSize = size.clone();
		var tiles = [2];
		var imageSize =  [2];
		tiles[0] = Math.ceil( $.max_width / $.standardTileSize );
		tiles[1] = Math.ceil( $.max_height / $.standardTileSize );
		imageSize[0] = $.max_width;
		imageSize[1] = $.max_height;
		
		$.tierSizeInTiles.push( tiles );
		$.tierImageSize.push( imageSize );

		while (imageSize[0] > $.standardTileSize ||
		       imageSize[1] > $.standardTileSize ) {

		    imageSize[0] = Math.floor( imageSize[0]/ 2 );
			imageSize[1] = Math.floor( imageSize[1] / 2 );
			
			tiles[0] = Math.ceil( imageSize[0] / $.standardTileSize );        
			tiles[1] = Math.ceil( imageSize[1] / $.standardTileSize );
			
		    $.tierSizeInTiles.push( tiles );
		    $.tierImageSize.push( imageSize );
		}

		$.tierSizeInTiles.reverse();
		$.tierImageSize.reverse();
		$.numberOfTiers = $.tierSizeInTiles.length;

		$.tileCountUpToTier[0] = 0;      
		for (var i = 1; i < $.numberOfTiers; i++) {
		    $.tileCountUpToTier.push(
		        $.tierSizeInTiles[i-1][0] * $.tierSizeInTiles[i-1][1] +
		        $.tileCountUpToTier[i-1]
		        );
		}
		$.num_resolutions = $.numberOfTiers;
		$.res = $.num_resolutions;
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
    	var navwin = $('<div id="navwin"></div>').css("width",$.min_x).css("height",$.min_y).css("position","relative");
    	navcontainer.append(navwin);
    	var src="";
    	// Create our navigation image and inject inside the div we just created
    	if($.fileFormat == "tiff")
		  	var src = $.server + '?FIF=' + $.images[0].src + '&SDS=' + $.images[0].sds + '&CNT=1.0' +'&WID=' + $.min_x + '&QLT=99&CVT=jpeg';
		  else
		  	src =  $.server + $.images[0].src+"/TileGroup"+0+"/0-0-0.jpg";
    	
    	var navimage = $('<img id="navigation"/>').attr("src",src);
    	navwin.append(navimage);
    	
    	// Create our navigation zone and inject inside the navigation div
		var zone;
		if($.fileFormat == "tiff")
    		zone = $('<div id="zone"></div>').css("width",$.min_x/2).css("height",$.min_y/2).css("opacity",0.4);
		else
			// TODO
			zone = $('<div id="zone"></div>').css("width",$.min_x/2).css("height",$.min_y/2).css("opacity",0.4);
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
								$(this).scrollNavigation(event,ui);
							}
							,start:function(event, ui) {
								$.navpos = [$('#zone').position().left, $('#zone').position().top-10];
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
    
    $.fn.scrollNavigation = function(ev,ui){
   		$(this).log("called scroll navigation");
   		var xmove = 0;
		var ymove = 0;
	
		var zone_w = $("#zone").width();
		var zone_h = $("#zone").height();
		//console.log(ui.position);
		  xmove = ui.position.left;
		  ymove = ui.position.top-10;
		  if( (Math.abs(xmove-$.navpos[0]) < 3) && (Math.abs(ymove-$.navpos[1]) < 3) ) return;
	
		if( xmove > ($.min_x - zone_w) ) xmove = $.min_x - zone_w;
		if( ymove > ($.min_y - zone_h) ) ymove = $.min_y - zone_h;
		if( xmove < 0 ) xmove = 0;
		if( ymove < 0 ) ymove = 0;
	
		$.rgn_x = Math.round(xmove * $.wid / $.min_x);
		$.rgn_y = Math.round(ymove * $.hei / $.min_y);
	 
		$(this).requestImages();
		//if( e.event ) this.positionZone();
    }
    
    $.fn.scrollTo = function(dx,dy){
   		$(this).log("called scroll navigation "+dx+" "+dy);
   		if( dx || dy ){
		  // To avoid unnecessary redrawing ...
		  if( (Math.abs(dx) < 3) && (Math.abs(dy) < 3) ) return;
		  $(this).checkBounds(dx,dy);
		  $(this).requestImages();
		  $(this).positionZone();
		}
    }
    
    $.fn.zoomIn = function(){
   		$(this).log("called zoom in");
   		if( ($.wid <= ($.max_width/2)) && ($.hei <= ($.max_height/2)) ){
		   $.res++;
		   $.wid = $.max_width;
		   $.hei = $.max_height;
		   for( var i=$.res; i<$.num_resolutions-1; i++ ){
		 $.wid = Math.floor($.wid/2);
		 $.hei = Math.floor($.hei/2);
		   }
	 
		   if( $.xfit == 1 ){
		 $.rgn_x = $.wid/2 - ($.rgn_w/2);
		   }
		   else if( $.wid > $.rgn_w ) $.rgn_x = 2*$.rgn_x + $.rgn_w/2;
	 
		   if( $.rgn_x > $.wid ) $.rgn_x = $.wid - $.rgn_w;
		   if( $.rgn_x < 0 ) $.rgn_x = 0;
	 
		   if( $.yfit == 1 ){
		 $.rgn_y = $.hei/2 - ($.rgn_h/2);
		   }
		   else if( $.hei > $.rgn_h ) $.rgn_y = $.rgn_y*2 + $.rgn_h/2;
	 
		   if( $.rgn_y > $.hei ) $.rgn_y = $.hei - $.rgn_h;
		   if( $.rgn_y < 0 ) $.rgn_y = 0;
	 
		   $(this).requestImages();
		   $(this).positionZone();
		   if( $.scale ) $(this).setScale();
	 
		 }
    }
    
    $.fn.checkBounds = function(dx,dy){
   		var x = $.rgn_x + dx;
		var y = $.rgn_y + dy;
	
		if( x > $.wid - $.rgn_w ) x = $.wid - $.rgn_w;
		if( y > $.hei - $.rgn_h ) y = $.hei - $.rgn_h;
		if( x < 0 ) x = 0;
		if( y < 0 ) y = 0;
	
		$.rgn_x = x;
		$.rgn_y = y;
    }
	
	$.fn.zoomOut = function(){
   		$(this).log("called zoom out");
   		if( ($.wid > $.rgn_w) || ($.hei > $.rgn_h) ){
		  $.res--;
		  $.wid = $.max_width;
		  $.hei = $.max_height;
		  for( var i=$.res; i<$.num_resolutions-1; i++ ){
		$.wid = Math.floor($.wid/2);
		$.hei = Math.floor($.hei/2);
		  }
	
		  $.rgn_x = $.rgn_x/2 - ($.rgn_w/4);
		  if( $.rgn_x + $.rgn_w > $.wid ) $.rgn_x = $.wid - $.rgn_w;
		  if( $.rgn_x < 0 ){
		$.xfit=1;
		$.rgn_x = 0;
		  }
		  else $.xfit = 0;
	
		  $.rgn_y = $.rgn_y/2 - ($.rgn_h/4);
		  if( $.rgn_y + $.rgn_h > $.hei ) $.rgn_y = $.hei - $.rgn_h;
		  if( $.rgn_y < 0 ){
		$.yfit=1;
		$.rgn_y = 0;
		  }
		  else $.yfit = 0;
	
		  $(this).requestImages();
		  $(this).positionZone();
		  //if( $.scale ) this.setScale();
		}
    }
    
    $.fn.scroll = function(){
    	var xmove =  - $('#target').offset().left;
		var ymove =  - $('#target').offset().top;
		$(this).scrollTo( xmove, ymove );
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
		$("#target" ).draggable({scroll:true
									,stop: function(event, ui) {
											$(this).scroll();
											return;
									}
									,start:function(event, ui) {
											return;
									}
								});
		$("#target" ).bind("drag",function(event,ui) {
  							//event.preventDefault();
  							$(this).log(ui.position);
  							var top = ui.position.top;
  							var left = ui.position.left;
  							var out;
  							// check X
  							if( $.rgn_x - left < 0 ){
							   ui.position.left = $.rgn_x;
							   out = true;
							 }
							 if( $.wid > $.rgn_w ){
							   if( $.rgn_x - left > $.wid - $.rgn_w ){
								 ui.position.left = -($.wid - $.rgn_w - $.rgn_x);
								 out = true;
							   }
							 }
							 else{
							   ui.position.left = 0;
							   out = true;
							 }
  							
  							//check Y
  							if( ($.rgn_y - ui.position.top) < 0 ){
							   ui.position.top = $.rgn_y;
							   out = true;
							 }
							 if( $.hei > $.rgn_h ){
							   if( $.rgn_y - ui.position.top > $.hei - $.rgn_h ){
								 ui.position.top = -($.hei - $.rgn_h - $.rgn_y);
								 out = true;
							   }
							 }
							 else{
							   ui.position.top = 0;
							   out = true;
							 }
						}
  					);
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
		
		var border = $('#zone')[0].offsetHeight - $('#zone')[0].clientHeight;
		// #zone.#navwin CSS position attribute needs to be absolute
		$("#zone").animate({
							"left":pleft,
							"top":ptop,
							"width": width - border/2,
							"height": height - border/2
							}, 500);
	}
	
	/* 
   	*/
	$.fn.loadGrid = function(){
   		$(this).log("rgn_x",$.rgn_x);
   		
   		 //var pos = $($.source).getPosition();

		// Delete our old image mosaic
		$('#target').children().remove();
		$('#target').css("left",0).css("top",0);
		
		// Get the start points for our tiles
	   var startx = Math.floor( $.rgn_x / $.tileSize[0] );
	   var starty = Math.floor( $.rgn_y / $.tileSize[1] );
   	
	  // If our size is smaller than the display window, only get these tiles!
	  var len = $.rgn_w;
	  if( $.wid < $.rgn_w ) len = $.wid;
	  var endx =  Math.floor( (len + $.rgn_x) / $.tileSize[0]);
	  
	  len = $.rgn_h;
	  if( $.hei < $.rgn_h ) len = $.hei;
	  var endy = Math.floor( (len + $.rgn_y) / $.tileSize[1]);
	  
	  // Number of tiles is dependent on view width and height
	  var xtiles = Math.ceil($.wid / $.tileSize[0]);
	  var ytiles = Math.ceil($.hei / $.tileSize[1]);
	  
	  /* Calculate the offset from the tile top left that we want to display.
       Also Center the image if our viewable image is smaller than the window
	  */
	  var xoffset = Math.floor($.rgn_x % $.tileSize[0]);
	  if( $.wid < $.rgn_w ) xoffset -=  ($.rgn_w - $.wid)/2;
  
	  var yoffset = Math.floor($.rgn_y % $.tileSize[1]);
	  if( $.hei < $.rgn_h ) yoffset -= ($.rgn_h - $.hei)/2;
	  
	  //console.log("offset x %d and offset y %d",xoffset,yoffset);
  
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
			if( $.render == 'spiral' ){
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
	  
	  $.nTilesLoaded = 0;
	  $.nTilesToLoad = ntiles*$.images.length;

	  map.sort(function s(a,b){return a.n - b.n;});
	  
	  for( var m=0; m<ntiles; m++ ){
		var i = map[m].x;
		var j = map[m].y;
  
		// Sequential index of the tile in the tif image
		// this variable needs to be changed for zoomify support
		if($.fileFormat == "tiff")
			k = i + (j*xtiles);
  
		// Iterate over the number of layers we have
		var n;
		for(n=0;n<$.images.length;n++){
		  $(this).log("Writing tile element");
		  if($.fileFormat == "tiff")
		  	tile = $("<img />").attr("class",'layer'+n).css("left",(i-startx)*$.tileSize[0] - xoffset).css("top",(j-starty)*$.tileSize[1] - yoffset);
		  else{
			// TODO fix here
			tile = $("<img />").attr("class",'layer'+n).css("left",(i-startx)*$.tileSize[0] - xoffset).css("top",(j-starty)*$.tileSize[1] - yoffset);
		}
		  tile.bind("load",function(){$.nTilesLoaded++;})
  
	  // We set the source at the end so that the 'load' function is properly fired
		  var src = "";
		  if($.fileFormat == "tiff")
		  	src = $.server+"?FIF="+$.images[n].src+"&cnt="+$.contrast+"&sds="+$.images[n].sds+"&jtl="+$.res+"," + k;
		  else{
			var tileIndex = i + j * $.tierSizeInTiles[$.res-1].w + $.tileCountUpToTier[$.res-1]; 
			var tileIndex = 0;
		  	src = "http://localhost/~56k/mooviewer/moov-port-zoom/VF_0178/"+"TileGroup"+tileIndex+"/"+$.res+"-"+j+"-"+i+".jpg";
			}
		  tile.attr( 'src', src );
		  $("#target").append(tile);
		}
		
	  }
  		/*
	  if($.images.length > 1 ){
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
		$('#target').css( 'cursor', 'wait' );
	
		// Load our image mosaic
		$(this).loadGrid();
	
		// bypassed the refresher for the time being
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
			$(this).log(msg);
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