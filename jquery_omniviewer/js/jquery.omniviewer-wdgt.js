$.widget("cch.OmniViewer", {
	options: {
        value: 0,
        debug: true,
        // TODO initialise default values
        
    },

	_create: function() {
	    this._initialise();
	    this.element
            .addClass("ow")
            // bogus method
            .text(this.element.attr("id")+"_"+this.options.value + "%");
	},
	
	_initialiseZoomify: function(){
		return;
	},
	
	_load:function(){
		/*
		* Calls the IIPImage server
		*/
		if(this.fileFormat == "iip"){
			var query_string = "&obj=IIP,1.0&obj=Max-size&obj=Tile-size&obj=Resolution-number";
			var self = this;
			// issue the ajax query
			$.ajax({
			 url: this.server + "?" +"FIF=" + this.images[0].src + query_string,
			 context:self,
			 success: function(data){
				var response = data || alert( "No response from server " + this.server );
				console.info(response);
				var tmp = response.split( "Max-size" );
				if(!tmp[1]) alert( "Unexpected response from server " + this.server );
				var size = tmp[1].split(" ");
				this.max_width = parseInt( size[0].substring(1,size[0].length) );
				this.max_height = parseInt( size[1] );
				tmp = response.split( "Tile-size" );
				size = tmp[1].split(" ");
				this.tileSize[0] = parseInt( size[0].substring(1,size[0].length) );
				this.tileSize[1] = parseInt( size[1] );
				tmp = response.split( "Resolution-number" );
				this.num_resolutions = parseInt( tmp[1].substring(1,tmp[1].length) );
				this.res = this.num_resolutions;
				this._createWindows();
				
			 },
			 error:function(){
				console.error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		/*
		* Calls the Zoomify pseudo-server
		*/
		else if(this.fileFormat == "zoomify"){
			var query_string = "ImageProperties.xml";
			var self = this;
			$.ajax({
			 url: this.server + "/"+this.images[0].src + "/"+ query_string,
			 context:self,
			 success: function(data){
				this.max_width = parseInt(0);
				this.max_height = parseInt(1);
				this.tileSize[0] = this.standardTileSize;
				this.tileSize[1] = this.standardTileSize;

				$(data).find("IMAGE_PROPERTIES").each( function(){

					self.max_width = parseInt($(this).attr("WIDTH"));
					self.max_height = parseInt($(this).attr("HEIGHT"));
					self.tileSize[0] = parseInt($(this).attr("TILESIZE"));
					self.tileSize[1] = self.tileSize[0];
					
				});
				var response = data || alert( "No response from server " + this.server );
				this._initialiseZoomify();
				this._createWindows();
			 },
			 error:function(){
				console.error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		/*
		* Calls the Djatoka image server
		*/
		else if(this.fileFormat == "djatoka"){
			// MODIFY
			var self = this;
			$.ajax({
			 url: this.server + "?"+"url_ver=Z39.88-2004&rft_id=" + this.images[0].src + "&svc_id=info:lanl-repo/svc/getMetadata",
			 context:self,
			 success: function(data){
				var resp = data || alert("No response from server " + this.server);
				this.max_width = parseInt(resp.width);
	            this.max_height = parseInt(resp.height);
	            this.tileSize[0] = 256;
		        this.tileSize[1] = 256;
	            this.num_resolutions = parseInt(resp.levels);
	            this.res = this.num_resolutions;
				$(this).createWindows();
			 },
			 error:function(){
				$(this).log_error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		this._trigger("ready", null, { self:this});
		return;
	},
	
	_createWindows : function(){
		console.info("createWindows called");
		var winWidth = this.element.width();
		var winHeight = this.element.height();
		
		// Calculate some sizes and create the navigation window
    	this._calculateMinSizes();
    	this._createNavigationWindow();
    	
    	// Create our main window target div, add our events and inject inside the frame
    	var el = $('<div></div>').addClass("target").css("cursor","move");
    	this.element.append(el);
    	console.info($(this.source+" "+'div.target'));
		$(this.source+" "+'div.target').draggable({scroll:true
									,stop: function(event, ui) {
											this._scroll;
											return;
									}
									,start:function(event, ui) {
											return;
									}
								});
								
		
							
		$(this.source+" "+'div.target').bind("drag",function(event,ui) {
  							console.log(ui.position);
  							var top = ui.position.top;
  							var left = ui.position.left;
  							var out;
  							// check X
  							if( this.rgn_x - left < 0 ){
							   ui.position.left = this.rgn_x;
							   out = true;
							 }
							 if( this.wid > this.rgn_w ){
							   if( this.rgn_x - left > this.wid - this.rgn_w ){
								 ui.position.left = -(this.wid - this.rgn_w - this.rgn_x);
								 out = true;
							   }
							 }
							 else{
							   ui.position.left = 0;
							   out = true;
							 }
  							
  							//check Y
  							if( (this.rgn_y - ui.position.top) < 0 ){
							   ui.position.top = this.rgn_y;
							   out = true;
							 }
							 if( this.hei > this.rgn_h ){
							   if( this.rgn_y - ui.position.top > this.hei - this.rgn_h ){
								 ui.position.top = -(this.hei - this.rgn_h - this.rgn_y);
								 out = true;
							   }
							 }
							 else{
							   ui.position.top = 0;
							   out = true;
							 }
						}
						
  					);
  					
		$(this.source+" "+'div.target').bind('mousewheel', this._zoom);
		this.rgn_w = winWidth;
    	this.rgn_h = winHeight;
    	
    	this._reCenter();
    	
    	$(window).resize(function() {
 			window.location=window.location;
		});
    	
    	for(var i=0;i<this.initialZoom;i++) this._zoomIn();

   		this._zoomOut();
    	this._requestImages();
    	this._positionZone();
    	
		return;
	},
	
	_initialiseZoomify : function(){
		var tiles = [2];
		var imageSize =  [2];
		tiles[0] = Math.ceil( this.max_width / this.standardTileSize );
		tiles[1] = Math.ceil( this.max_height / this.standardTileSize );
		imageSize[0] = this.max_width;
		imageSize[1] = this.max_height;
		
		this.tierSizeInTiles.push(new Array(tiles[0],tiles[1]));
		this.tierImageSize.push( imageSize );
		console.log("Tiles %s",tiles);

		while (imageSize[0] > this.standardTileSize ||
		       imageSize[1] > this.standardTileSize ) {

		    imageSize[0] = Math.floor( imageSize[0]/ 2 );
			imageSize[1] = Math.floor( imageSize[1] / 2 );
			
			tiles[0] = Math.ceil( imageSize[0] / this.standardTileSize );        
			tiles[1] = Math.ceil( imageSize[1] / this.standardTileSize );
			console.log("pre "+this.tierSizeInTiles);
		    this.tierSizeInTiles.push(new Array(tiles[0],tiles[1]));
		    console.log("post "+this.tierSizeInTiles);
		    this.tierImageSize.push( imageSize );
		    console.log(this.tierImageSize);
		}

		this.tierSizeInTiles.reverse();
		this.tierImageSize.reverse();
		this.numberOfTiers = this.tierSizeInTiles.length;

		this.tileCountUpToTier[0] = 0;      
		for (var i = 1; i < this.numberOfTiers; i++) {
			//console.log("this.tierSizeInTiles tier=%i %i",i-1,this.tierSizeInTiles[i-1][0]);
			var temp = this.tierSizeInTiles[i-1][0] * this.tierSizeInTiles[i-1][1] +
		        this.tileCountUpToTier[i-1];
		    //console.log("tileCountUpToTier %i",temp);
		    this.tileCountUpToTier.push(
		        temp
		        );
		    //console.log("this.tileCountUpToTier tier=%i %i",i,temp);
		}
		this.num_resolutions = this.numberOfTiers;
		this.res = this.num_resolutions;
	},
	
	_reCenter : function(){
		this.rgn_x = (this.wid-this.rgn_w)/2;
   		this.rgn_y = (this.hei-this.rgn_h)/2;
   		console.log("called reCenter %d %d",this.rgn_x,this.rgn_y);
	},
	
	_calculateMinSizes : function(){
		var tx = this.max_width;
		var ty = this.max_height;
		var thumb = 100;
	
		var winWidth = this.element.width();
		var winHeight = this.element.height();
		console.log("minwidth=%i minheight=%i",winWidth,winHeight);
		if( winWidth>winHeight ){
		  // For panoramic images, use a large navigation window
		  if( tx > 2*ty ) thumb = winWidth / 2;
		  else thumb = winWidth / 4;
		}
		else thumb = winHeight / 4;
	
		var r = this.res;
		while( tx > thumb ){
		  tx = parseInt(tx / 2);
		  ty = parseInt(ty / 2);
		  // Make sure we don't set our navigation image too small!
		  if( --r == 1 ) break;
		}
		this.min_x = tx;
		this.min_y = ty;
	
		// Determine the resolution for this image view
		tx = this.max_width;
		ty = this.max_height;
		while( tx > winWidth && ty > winHeight ){
		  tx = parseInt(tx / 2);
		  ty = parseInt(ty / 2);
		  this.res--;
		}
		this.wid = tx;
		this.hei = ty;
		this.res--;
		console.log("CalcMinSizes: wid=%i hei=%i",this.wid,this.hei);
		return;
	},
	
	_createNavigationWindow : function(){
		console.log("called createNavigationWindow()");
    	
    	var navcontainer = $('<div></div>').addClass("navcontainer").css("width",this.min_x).css("height",10);
    	// we'll worry later about how to change the @title into a proper tooltip
    	var toolbar = $('<div></div>').addClass("toolbar").css("width",this.min_x).attr("title",'* Drag to move. Double Click to show/hide navigation buttons');
    	navcontainer.append(toolbar);
    	if(this.showNavigation){
			// Create our navigation div and inject it inside our frame
			var navwin = $('<div></div>').addClass("navwin").css("width",this.min_x).css("height",this.min_y).css("position","relative");
			navcontainer.append(navwin);
			var src="";
			// Create our navigation image and inject inside the div we just created
			if(this.fileFormat == "iip")
				var src = this.server + '?FIF=' + this.images[0].src + '&SDS=' + this.images[0].sds + '&CNT=1.0' +'&WID=' + this.min_x + '&QLT=99&CVT=jpeg';
			 else if(this.fileFormat == "zoomify")
				src =  this.server +"/"+ this.images[0].src+"/TileGroup"+0+"/0-0-0.jpg";
			else if(this.fileFormat == "djatoka")
				src =  this.server +  "?url_ver=Z39.88-2004&rft_id="
				            + this.images[0].src + "&svc_id=" + $.svc_id
				            + "&svc_val_fmt=" + $.svc_val_fmt
				            + "&svc.format=image/jpeg&svc.scale=" + this.min_x + "," + this.min_y;
			
			var navimage = $('<img/>').addClass("navigation").attr("src",src);
			navwin.append(navimage);
			
			// Create our navigation zone and inject inside the navigation div
			var zone;
			if(this.fileFormat == "iip")
				zone = $('<div class="zone"></div>').css("width",this.min_x/2).css("height",this.min_y/2).css("opacity",0.4);
			else
				// TODO
				zone = $('<div class="zone"></div>').css("width",this.min_x/2).css("height",this.min_y/2).css("opacity",0.4);
			navwin.append(zone);
    	}
    	// Create our progress bar
    	var loadBarContainer = $('<div></div>').addClass("loadBarContainer").css("width",this.min_x-2).css("height",10).append($('<div></div>').addClass("loadBar"));
    	
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
    	// and then snap it into the page;	
    	this.element.append(navcontainer);
    	// Hide our navigation buttons if requested
    	if( this.showNavButtons == false ) {
    		// act accordingly
    		return;
    	};
    	
    	$(this.source+" "+'div.zone').draggable({
    						containment:$(this.source +" div.navwin")
    						,stop: function(event, ui) {
								this._scrollNavigation(event,ui);
							}
							,start:function(event, ui) {
								this.navpos = [$(this.source+" "+'div.zone').position().left, $(this.source+" "+'div.zone').position().top-10];
							}
    	});
    	
    	
    	
    	navcontainer.draggable( {containment:this.source, handle:"toolbar"} );
    	
    	// ADD EVENT BINDINGS TO NAV BUTTONS
    	$(this.source+' img.zoomIn').bind( 'click', this._zoomIn);
		$(this.source+' img.zoomOut').bind( 'click', this._zoomOut);
		$(this.source+' img.reset').bind( 'click', function(){
			window.location=window.location; 
		});
		$(this.source+' img.shiftLeft').bind( 'click', {x:-this.rgn_w/3,y:0,self:this},function(e){ 
			e.data.self._scrollTo(e.data.x,e.data.y);
		});
		$(this.source+' img.shiftUp').bind( 'click', {x:0,y:-this.rgn_h/3,self:this},function(e){
			e.data.self._scrollTo(e.data.x,e.data.y);
		});
		$(this.source+' img.shiftDown').bind( 'click',{x:0,y:this.rgn_h/3,self:this}, function(e){
			e.data.self._scrollTo(e.data.x,e.data.y);
		});
		$(this.source+' img.shiftRight').bind( 'click', {x:this.rgn_w/3,y:0,self:this},function(e){ 
			e.data.self._scrollTo(e.data.x,e.data.y);
		});
		
		$(this.source+' img.navigation').bind('mousewheel', this._zoom);
		
		$(this.source+" "+'div.zone').bind('mousewheel', this._zoom);
		
		// TODO for the time being I leave behind minor events bound to #zone.click
	},
	
	_zoomIn : function(){
		console.info("Called zoomIn but not implemented yet");
	},
	
	_zoomOut : function(){
		console.info("Called zoomOut but not implemented yet");
	},
	
	_loadGrid : function(){
		console.info($(this.source));
		console.info("Called loadGrid but not implemented yet");
	},
	
	_zoom:function(event, delta, deltaX, deltaY){
		if(delta>0)
			this._zoomIn();
		else
			this._zoomOut();
	},
	
	_scroll:function(){
		var xmove =  - $(this.source+" "+'div.target').position().left;
    	console.debug($(this.source+" "+'div.target').offset().left,$(this.source+" "+'div.target').position().left);
		var ymove =  - $(this.source+" "+'div.target').position().top;
		this._scrollTo( xmove, ymove );
	},
	
	_scrollTo:function(dx,dy){
		console.info("Called scrollTo but not implemented yet");
	},
	
	_requestImages : function(){
		// bypassed the refresher for the time being
		// Set our cursor
		$(this.source+" "+'div.target').css( 'cursor', 'wait' );
		// Load our image mosaic
		this._loadGrid();
		// bypassed the refresher for the time being
	},
	
	_positionZone : function(){
		console.info("Called positionZone but not implemented yet");
	},
	
	_initialise: function(){
		console.info("Initialising Omniviewer at "+this.element.attr("id"));
		this.source = "#"+this.element.attr("id") ||  alert( 'No element ID given to IIP constructor' );
		this.server = this.options.server || '/fcgi-bin/iipsrv.fcgi';
		
		this.render = this.options.render || 'random';
		
		this.options.image || alert( 'Image location not set in IIP constructor options');
    	if(this.options.image instanceof Array){
    		this.images = new Array(this.options.image.length);
			for( i=0; i<this.options.image.length;i++ ){
	    		this.images[i] = { src:this.options.image[i], sds:"0,90" };
			}
    	}
    	else this.images = [{ src:this.options.image, sds:"0,90"} ];
    	
    	this.fileFormat = this.options.fileFormat;
    	console.info("The selected file format is \"%s\"",this.fileFormat);
    	
    	this.credit = this.options.credit || null;
    	
    	this.scale = this.options.scale || null;
    	
    	if( this.options.zoom == 0 ) this.initialZoom = 0;
    	else this.initialZoom = this.options.zoom || 1;
    	
    	this.showNavButtons = true;
    	if( this.options.showNavButtons == false ) this.showNavButtons = false;
    	
    	this.showNavigation = true;
    	if( this.options.showNavigation == false ) this.showNavigation = false;
    	
    	// If we want to assign a function for a click within the image
    	// - used for multispectral curve visualization, for example
    	this.targetclick = this.options.targetclick || null;
    	/* global variables */
		this.max_width = 0;
		this.max_height = 0;
		this.min_x = 0;
		this.min_y = 0;
		this.sds = "0,90";
		this.contrast = 1.0;
		this.opacity = 0;
		this.wid = 0;
		this.hei = 0;
		this.rgn_x = 0;
		this.rgn_y = 0;
		this.rgn_w = this.wid;
		this.rgn_h = this.wid;
		this.xfit = 0;
		this.yfit = 0;
		this.navpos = [0,0];
		this.tileSize = [0,0];
		this.num_resolutions = 0;
		this.res = 0;
		this.standardTileSize = 256;
		this.refresher = null;
		// if zoomify
		if(this.fileFormat == "zoomify"){
			this.tileCountUpToTier = new Array();
			this.tierSizeInTiles = new Array();
			this.tierImageSize = new Array();
		}
		// Number of tiles loaded
		this.nTilesLoaded = 0;
		this.nTilesToLoad = 0;
		this.max_zoom = 7;
		this.top_left_x = 0;
		this.top_left_y = 0;
		this.svc_val_fmt = "info:ofi/fmt:kev:mtx:jpeg2000";
		this.svc_id = "info:lanl-repo/svc/getRegion";
		this.openUrl = "";
		
		this.element.addClass("targetframe");
		this._load();
	}
});