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
		this._trigger("ready", null, { self:this});
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
				//this._createWindows();
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
		return;
	},
	
	_initialise: function(){
		console.info("Initialising Omniviewer at "+this.element.attr("id"));
		this.source += this.element.attr("id") ||  alert( 'No element ID given to IIP constructor' );
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