$.widget("cch.OmniViewer", {
	options: {
        value: 0,
        debug: true,
        // TODO initialise default values
        
    },

	_create: function() {
		this.debug = this.options.debug;
	    this._initialise();
	    this.element
            .addClass("ow");
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
				this._info(response);
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
				this._createWindows();
			 },
			 error:function(){
				console.error("Unable to get image and tile sizes from server!");
			 },
			});
		}
		this._trigger("ready", null, { self:this});
		return;
	},
	
	_createWindows : function(){
		this._info("createWindows called");
		var winWidth = this.element.width();
		var winHeight = this.element.height();
		
		// Calculate some sizes and create the navigation window
    	this._calculateMinSizes();
    	this._createNavigationWindow();
    	
    	// Create our main window target div, add our events and inject inside the frame
    	var el = $('<div></div>').addClass("target").css("cursor","move");
    	this.element.append(el);
    	this._info($(this.source+" "+'div.target'));
    	var self = this;
		$(this.source+" "+'div.target').draggable({scroll:true
									,stop: function(event, ui) {
											self._scroll();
											return;
									}
									,start:function(event, ui) {
											return;
									}
								});
								
		
							
		$(this.source+" "+'div.target').bind("drag",{self:this},function(event,ui) {
  							$this = event.data.self;
  							var top = ui.position.top;
  							var left = ui.position.left;
  							var out;
  							// check X
  							if( $this.rgn_x - left < 0 ){
							   ui.position.left = $this.rgn_x;
							   out = true;
							 }
							 if( $this.wid > $this.rgn_w ){
							   if( $this.rgn_x - left > $this.wid - $this.rgn_w ){
								 ui.position.left = -($this.wid - $this.rgn_w - $this.rgn_x);
								 out = true;
							   }
							 }
							 else{
							   ui.position.left = 0;
							   out = true;
							 }
  							
  							//check Y
  							if( ($this.rgn_y - ui.position.top) < 0 ){
							   ui.position.top = $this.rgn_y;
							   out = true;
							 }
							 if( $this.hei > $this.rgn_h ){
							   if( $this.rgn_y - ui.position.top > $this.hei - $this.rgn_h ){
								 ui.position.top = -($this.hei - $this.rgn_h - $this.rgn_y);
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
		this._log("Tiles %s",tiles);

		while (imageSize[0] > this.standardTileSize ||
		       imageSize[1] > this.standardTileSize ) {

		    imageSize[0] = Math.floor( imageSize[0]/ 2 );
			imageSize[1] = Math.floor( imageSize[1] / 2 );
			
			tiles[0] = Math.ceil( imageSize[0] / this.standardTileSize );        
			tiles[1] = Math.ceil( imageSize[1] / this.standardTileSize );
			this._log("pre "+this.tierSizeInTiles);
		    this.tierSizeInTiles.push(new Array(tiles[0],tiles[1]));
		    this._log("post "+this.tierSizeInTiles);
		    this.tierImageSize.push( imageSize );
		    this._log(this.tierImageSize);
		}

		this.tierSizeInTiles.reverse();
		this.tierImageSize.reverse();
		this.numberOfTiers = this.tierSizeInTiles.length;

		this.tileCountUpToTier[0] = 0;      
		for (var i = 1; i < this.numberOfTiers; i++) {
			//this._log("this.tierSizeInTiles tier=%i %i",i-1,this.tierSizeInTiles[i-1][0]);
			var temp = this.tierSizeInTiles[i-1][0] * this.tierSizeInTiles[i-1][1] +
		        this.tileCountUpToTier[i-1];
		    //this._log("tileCountUpToTier %i",temp);
		    this.tileCountUpToTier.push(
		        temp
		        );
		    //this._log("this.tileCountUpToTier tier=%i %i",i,temp);
		}
		this.num_resolutions = this.numberOfTiers;
		this.res = this.num_resolutions;
	},
	
	_reCenter : function(){
		this.rgn_x = (this.wid-this.rgn_w)/2;
   		this.rgn_y = (this.hei-this.rgn_h)/2;
   		this._log("called reCenter %d %d",this.rgn_x,this.rgn_y);
	},
	
	_calculateMinSizes : function(){
		var tx = this.max_width;
		var ty = this.max_height;
		var thumb = 100;
	
		var winWidth = this.element.width();
		var winHeight = this.element.height();
		this._log("minwidth=%i minheight=%i",winWidth,winHeight);
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
		this._log("CalcMinSizes: wid=%i hei=%i",this.wid,this.hei);
		return;
	},
	
	_createNavigationWindow : function(){
		this._log("called createNavigationWindow()");
    	
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
    	
    	var self = this;
    	$(this.source+" "+'div.zone').draggable({
    						containment:$(this.source +" div.navwin")
    						,stop: function(event, ui) {
								self._scrollNavigation(event,ui);
							}
							,start:function(event, ui) {
								self.navpos = [$(self.source+" "+'div.zone').position().left, $(self.source+" "+'div.zone').position().top-10];
							}
    	});
    	
    	
    	
    	navcontainer.draggable( {containment:this.source, handle:"toolbar"} );
    	
    	// ADD EVENT BINDINGS TO NAV BUTTONS
    	$(this.source+' img.zoomIn').bind( 'click',{self:this}, function(e){e.data.self._zoomIn()});
		$(this.source+' img.zoomOut').bind( 'click',{self:this}, function(e){e.data.self._zoomOut()});
		$(this.source+' img.reset').bind( 'click', {self:this},function(e){
			e.data.self._reset();
		});
		var val=-this.rgn_w/3;
		
		$(this.source+' img.shiftLeft').bind( 'click', {self:this},function(e){ 
			e.data.self._scrollTo(-e.data.self.rgn_w/3,0);
		});
		$(this.source+' img.shiftUp').bind( 'click', {self:this},function(e){
			e.data.self._scrollTo(0,-e.data.self.rgn_h/3);
		});
		$(this.source+' img.shiftDown').bind( 'click',{self:this}, function(e){
			e.data.self._scrollTo(0,e.data.self.rgn_h/3);
		});
		$(this.source+' img.shiftRight').bind( 'click', {x:this.rgn_w/3,y:0,self:this},function(e){ 
			e.data.self._scrollTo(e.data.self.rgn_w/3,0);
		});
		
		$(this.source+' img.navigation').bind('mousewheel',{self:this}, this._zoom);
		
		$(this.source+" "+'div.zone').bind('mousewheel',{self:this}, this._zoom);
		
		// TODO for the time being I leave behind minor events bound to #zone.click
	},
	
	_zoomIn : function(e){
		this._trigger("zoomIn", null);
   		if( (this.wid <= (this.max_width/2)) && (this.hei <= (this.max_height/2)) ){
		   this.res++;
		   this.wid = this.max_width;
		   this.hei = this.max_height;
			if(this.fileFormat == "djatoka"){
		  		var iter = this.num_resolutions;
			}
			else{
				var iter = this.num_resolutions-1;
			}
		   for( var i=this.res; i<iter; i++ ){
		 this.wid = Math.floor(this.wid/2);
		 this.hei = Math.floor(this.hei/2);
		   }
	 
		   if( this.xfit == 1 ){
		 this.rgn_x = this.wid/2 - (this.rgn_w/2);
		   }
		   else if( this.wid > this.rgn_w ) this.rgn_x = 2*this.rgn_x + this.rgn_w/2;
	 
		   if( this.rgn_x > this.wid ) this.rgn_x = this.wid - this.rgn_w;
		   if( this.rgn_x < 0 ) this.rgn_x = 0;
	 
		   if( this.yfit == 1 ){
		 this.rgn_y = this.hei/2 - (this.rgn_h/2);
		   }
		   else if( this.hei > this.rgn_h ) this.rgn_y = this.rgn_y*2 + this.rgn_h/2;
	 
		   if( this.rgn_y > this.hei ) this.rgn_y = this.hei - this.rgn_h;
		   if( this.rgn_y < 0 ) this.rgn_y = 0;
	 
		   this._requestImages();
		   if(this.showNavigation){
		   	this._positionZone();
		   	
		   }
		   if( this.scale ) this._setScale();
	 
		 }
		 return;
	},
	
	_zoomOut : function(e){
		this._trigger("zoomOut", null);
   		if( (this.wid > this.rgn_w) || (this.hei > this.rgn_h) ){
		  this.res--;
		  this.wid = this.max_width;
		  this.hei = this.max_height;
			if(this.fileFormat == "djatoka"){
		  		var iter = this.num_resolutions;
			}
			else{
				var iter = this.num_resolutions-1;
			}
		  for( var i=this.res; i<iter; i++ ){
		this.wid = Math.floor(this.wid/2);
		this.hei = Math.floor(this.hei/2);
		  }
	
		  this.rgn_x = this.rgn_x/2 - (this.rgn_w/4);
		  if( this.rgn_x + this.rgn_w > this.wid ) this.rgn_x = this.wid - this.rgn_w;
		  if( this.rgn_x < 0 ){
		this.xfit=1;
		this.rgn_x = 0;
		  }
		  else this.xfit = 0;
	
		  this.rgn_y = this.rgn_y/2 - (this.rgn_h/4);
		  if( this.rgn_y + this.rgn_h > this.hei ) this.rgn_y = this.hei - this.rgn_h;
		  if( this.rgn_y < 0 ){
		this.yfit=1;
		this.rgn_y = 0;
		  }
		  else this.yfit = 0;
	
		  this._requestImages();
		  this._positionZone();
		  //if( this.scale ) this.setScale();
		}
		return;
	},
	
	_reset : function(){
		this.destroy();
		this._initialise();	
	},
	
	_loadGrid : function(){
		this._log("rgn_x",this.rgn_x);
   		
   		 //var pos = $(this.source).getPosition();

		// Delete our old image mosaic
		$(this.source+" "+'div.target').children().remove();
		$(this.source+" "+'div.target').css("left",0).css("top",0);
		
		// Get the start points for our tiles
	   var startx = Math.floor( this.rgn_x / this.tileSize[0] );
	   var starty = Math.floor( this.rgn_y / this.tileSize[1] );
   	
	  // If our size is smaller than the display window, only get these tiles!
	  var len = this.rgn_w;
	  if( this.wid < this.rgn_w ) len = this.wid;
	  var endx =  Math.floor( (len + this.rgn_x) / this.tileSize[0]);
	  
	  len = this.rgn_h;
	  if( this.hei < this.rgn_h ) len = this.hei;
	  var endy = Math.floor( (len + this.rgn_y) / this.tileSize[1]);
	  
	  // Number of tiles is dependent on view width and height
	  var xtiles = Math.ceil(this.wid / this.tileSize[0]);
	  var ytiles = Math.ceil(this.hei / this.tileSize[1]);
	  
	  /* Calculate the offset from the tile top left that we want to display.
       Also Center the image if our viewable image is smaller than the window
	  */
	  var xoffset = Math.floor(this.rgn_x % this.tileSize[0]);
	  if( this.wid < this.rgn_w ) xoffset -=  (this.rgn_w - this.wid)/2;
  
	  var yoffset = Math.floor(this.rgn_y % this.tileSize[1]);
	  if( this.hei < this.rgn_h ) yoffset -= (this.rgn_h - this.hei)/2;
	  
	  //this._log("offset x %d and offset y %d",xoffset,yoffset);
	  //this._log("xtiles %d and ytiles %d",xtiles,ytiles);
  
	  var tile;
	  var i, j, k, n;
	  var left, top;
	  k = 0;
	  n = 0;
	  
	  var centerx = startx + Math.round((endx-startx)/2);
	  var centery = starty + Math.round((endy-starty)/2);
  
	  var map = new Array((endx-startx)*(endx-startx));
  
	  var ntiles=0;
	  for( j=starty; j<=endy; j++ ){
		for (i=startx;i<=endx; i++) {
  
			map[ntiles] = {};
			if( this.render == 'spiral' ){
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

	  
	  this.nTilesLoaded = 0;
	  this.nTilesToLoad = ntiles*this.images.length;
	  
	  if(this.fileFormat == "iip")
	  		map.sort(function s(a,b){return a.n - b.n;});
	  else if(this.fileFormat == "djatoka"){
			 // djatoka mods 
			 map.sort(function (a,b){return a > b;});
			 var first = true;
			 var r = this.num_resolutions - this.res;
			 var f = this._getMultiplier(r, this.tileSize[0]);
			 // end djatoka mods

	  }
	  
	  for( var m=0; m<ntiles; m++ ){
		var i = map[m].x;
		var j = map[m].y;
  
		// Sequential index of the tile in the tif image
		// this variable needs to be changed for zoomify support
		if(this.fileFormat == "iip")
			k = i + (j*xtiles);
		else if(this.fileFormat == "djatoka"){
			// djatoka mods 
			var djatoka_x = i * f;
			var djatoka_y = j * f;
			if (first) {
				  top_left_x = (djatoka_x + this._getMultiplier(r, xoffset-2));
				  top_left_y = (djatoka_y + this._getMultiplier(r, yoffset-2));
				  if (top_left_x < 0)
						top_left_x = 0;
				  if (top_left_y < 0)
						top_left_y = 0;
				  this._setOpenURL();
				  first = false;
			}
			// end djatoka mods

	  }
  
		// Iterate over the number of layers we have
		var n;
		if(this.fileFormat == "iip"||this.fileFormat == "zoomify"){
			 for(n=0;n<this.images.length;n++){
			   if(this.fileFormat == "iip"){
			   //.attr("class",'layer'+n)
				 tile = $("<img></img>").css("left",(i-startx)*this.tileSize[0] - xoffset).css("top",(j-starty)*this.tileSize[1] - yoffset);
			   }
			   else{
				 tile = $("<img></img>").css("left",(i-startx)*this.tileSize[0] - xoffset).css("top",(j-starty)*this.tileSize[1] - yoffset);
				 }
			   tile.bind("load",{self:this},function(e){
			   	e.data.self.nTilesLoaded++;
			   	e.data.self._refreshLoadBar();
			   });		
			   tile.bind("error",function(){return;});
	   
		   // We set the source at the end so that the 'load' function is properly fired
			   var src = "";
			   if(this.fileFormat == "iip")
				 src = this.server+"?FIF="+this.images[n].src+"&cnt="+this.contrast+"&sds="+this.images[n].sds+"&jtl="+this.res+"," + k;
			   else{
				 var tileIndex = i + j * this.tierSizeInTiles[this.res][0] + this.tileCountUpToTier[this.res];
				 tileIndex=parseInt(tileIndex/256);
				 
				 
				 src = this.server+"/"+this.images[n].src +"/"+"TileGroup"+tileIndex+"/"+this.res+"-"+i+"-"+j+".jpg";
				 }
			   tile.attr( 'src', src );
			   $(this.source+" "+'div.target').append(tile);
			 }
			 
		   }
	  else if(this.fileFormat == "djatoka"){
		   if (djatoka_x < this.max_width && djatoka_y < this.max_height) {
			for(n=0;n<this.images.length;n++){
	  
			 tile = $("<img />").attr("class",'layer'+n).css("left",(i-startx)*this.tileSize[0] - xoffset).css("top",(j-starty)*this.tileSize[1] - yoffset);
	  		 tile.bind("load",{self:this},function(e){
			   	e.data.self.nTilesLoaded++;
			   	e.data.self._refreshLoadBar();
			   });
			 tile.bind("error",function(){});
			 
			 // djatoka mods
			 var src = this.server + "?url_ver=Z39.88-2004&rft_id="
					 + this.images[n].src + "&svc_id=" + this.svc_id
					 + "&svc_val_fmt=" + this.svc_val_fmt
					 + "&svc.format=image/jpeg&svc.level="
					 + this.res + "&svc.rotate=0&svc.region="
					 + djatoka_y + "," + djatoka_x + ",256,256";
			 // end djatoka mods
			 
			 // We set the source at the end so that the 'load' function is properly fired
			 //var src = this.server+"?FIF="+this.images[n].src+"&cnt="+this.contrast+"&sds="+this.images[n].sds+"&jtl="+this.res+"," + k;
			 tile.attr( 'src', src );
			 $(this.source+" "+'div.target').append(tile);
		   }
		  } else 
			  this.nTilesLoaded++;
		 }
	  }
  		/*
  		* TODO
	  if(this.images.length > 1 ){
		var selector = 'img.layer'+(n-1);
		$$(selector).set( 'opacity', this.opacity );
	  }
	  */
	},
	
	_zoom:function(event, delta, deltaX, deltaY){
		if(delta>0)
			this._zoomIn();
		else
			this._zoomOut();
	},
	
	_scroll:function(){
		var xmove =  - $(this.source+" "+'div.target').position().left;
		var ymove =  - $(this.source+" "+'div.target').position().top;
		this._log("ScrollTo: %i - %i",xmove,ymove);
		this._scrollTo( xmove, ymove );
	},
	
	_scrollTo:function(dx,dy){
		this._log("called scroll navigation "+dx+" "+dy);
		this._trigger("scrollTo", null,{dx:dx,dy:dy});
   		if( dx || dy ){
		  // To avoid unnecessary redrawing ...
		  if( (Math.abs(dx) < 3) && (Math.abs(dy) < 3) ) return;
		  this._checkBounds(dx,dy);
		  this._requestImages();
		  if(this.showNavigation)
		  this._positionZone();
		}
	},
	
	_getMultiplier:function(r,f){
		var m = f;
	    for (i = 0; i < r; i++) {
	        m = m * 2;
	    }
	    return m;
	},
	
	// public methods
	
	scrollTo:function(dx,dy){
		this._log("values %s, %s",dx,dy);
		this._scrollTo(dx,dy);
	},
	
	getZoomLevel:function(){
		return this.res;
	},
	
	zoomIn:function(){
		this._zoomIn();
	},
	
	reset:function(){
		this._reset();
	},
	
	zoomOut:function(){
		this._zoomOut();
	},
	
	_refreshLoadBar:function(){
		var w = (this.nTilesLoaded / this.nTilesToLoad) * this.min_x;
	    $(this.source+" "+"div.loadBar").css( 'width', w );

	    // Display the % in the progress bar
	    $(this.source+" "+'div.loadBar').html('loading&nbsp;:&nbsp;'+Math.round(this.nTilesLoaded/this.nTilesToLoad*100) + '%' );
		
		$(this.source+" "+'div.loadBarContainer').fadeIn();
	    if( $(this.source+" "+'div.loadBarContainer').css( 'opacity') != 0.85 ){
	      $(this.source+" "+'div.loadBarContainer').css( 'opacity', 0.85 );
	    }

	    // If we're done with loading, fade out the load bar
	    if( this.nTilesLoaded == this.nTilesToLoad ){
	      // Fade out our progress bar and loading animation in a chain
	      $(this.source+" "+'div.target').css( 'cursor', 'move' );
	      $(this.source+" "+'div.loadBarContainer').fadeOut();
	    }
	},
	
	_checkBounds:function(dx,dy){
		this._log("checkBounds input: dx=%i dy=%i",dx,dy);
   		var x = this.rgn_x + dx;
		var y = this.rgn_y + dy;
		if( x > this.wid - this.rgn_w ) x = this.wid - this.rgn_w;
		if( y > this.hei - this.rgn_h ) y = this.hei - this.rgn_h;
		if( x < 0 ) x = 0;
		if( y < 0 ) y = 0;
		this.rgn_x = x;
		this.rgn_y = y;
		this._log("check bounds %i %i",this.rgn_x,this.rgn_y);
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
		this._log("called positionZone");
   		
   		var pleft = (this.rgn_x/this.wid) * (this.min_x);
		if( pleft > this.min_x ) pleft = this.min_x;
		if( pleft < 0 ) pleft = 0;
	
		var ptop = (this.rgn_y/this.hei) * (this.min_y);
		if( ptop > this.min_y ) ptop = this.min_y;
		if( ptop < 0 ) ptop = 0;
	
		var width = (this.rgn_w/this.wid) * (this.min_x);
		if( pleft+width > this.min_x ) width = this.min_x - pleft;
	
		var height = (this.rgn_h/this.hei) * (this.min_y);
		if( height+ptop > this.min_y ) height = this.min_y - ptop;
	
		if( width < this.min_x ) this.xfit = 0;
		else this.xfit = 1;
		if( height < this.min_y ) this.yfit = 0;
		else this.yfit = 1;
		if(this.showNavigation){
			var border = $(this.source+" "+'div.zone')[0].offsetHeight - $(this.source+" "+'div.zone')[0].clientHeight;
			$(this.source+" "+'div.zone').animate({
								"left":pleft,
								"top":ptop,
								"width": width - border/2,
								"height": height - border/2
								}, 500);
		}
	},
	
	_log:function(){
		if(!(typeof console == 'undefined')){
		var proxied = console.log;
		if(this.debug && console)
		 return proxied.apply(proxied, arguments);
		 }
	},
	
	_log_error:function(){
		if(!(typeof console == 'undefined')){
		var proxied = console.log;
		if(this.debug && console)
		 return proxied.apply(proxied, arguments);
		 }
	},
	
	_info:function(){
		if(!(typeof console == 'undefined')){
		var proxied = console.info;
		if(this.debug && console)
		 return proxied.apply(proxied, arguments);
		}
	},
	
	_scrollNavigation:function(event,ui){
		this._log("called scroll navigation");
   		var xmove = 0;
		var ymove = 0;
	
		var zone_w = $(this.source+" "+'div.zone').width();
		var zone_h = $(this.source+" "+'div.zone').height();
		//console.log(ui.position);
		  xmove = ui.position.left;
		  ymove = ui.position.top-10;
		  if( (Math.abs(xmove-this.navpos[0]) < 3) && (Math.abs(ymove-this.navpos[1]) < 3) ) return;
	
		if( xmove > (this.min_x - zone_w) ) xmove = this.min_x - zone_w;
		if( ymove > (this.min_y - zone_h) ) ymove = this.min_y - zone_h;
		if( xmove < 0 ) xmove = 0;
		if( ymove < 0 ) ymove = 0;
	
		this.rgn_x = Math.round(xmove * this.wid / this.min_x);
		this.rgn_y = Math.round(ymove * this.hei / this.min_y);
	 
		this._requestImages();
	},
	
	_initialise: function(){
		this._info("Initialising Omniviewer at "+this.element.attr("id"));
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
    	this._info("The selected file format is \"%s\"",this.fileFormat);
    	
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
	},
	
	destroy:function(){
		$.Widget.prototype.destroy.apply(this, arguments); 
		$(this.source+" > "+"div.target").remove();
		$(this.source+" > "+"div.navcontainer").remove();
		this.element.removeClass( "ow targetframe" );
		
	}
});

