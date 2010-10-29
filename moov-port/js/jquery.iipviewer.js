var DEBUG = true;

var log = function(msg){
	if(DEBUG){
		console.log(msg);
	}
};
// the object embedding the plugin
(function($){
	$.vari = null;
	
	$.fn.test = function(){log($.vari);}

	$.fn.createWindows = function(value){log('test create windows'+value);}

	$.fn.IIP = function(options) {
		var defaults = {
			image : null,
			value : " !cheers!"
		};
		
		var options = $.extend(defaults, options);
		
    	return this.each(function() {
			log('plugin IIP initialised');
			$(this).test();
			$(this).createWindows(options.value);
			return false;
    	});
 	};
})(jQuery);