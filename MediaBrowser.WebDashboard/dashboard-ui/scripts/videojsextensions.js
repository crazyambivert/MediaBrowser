﻿//parse video player src URL
function parse_src_url(url) {
	var src = url.replace("\?", "\&");
	var parts = src.split("/");
	var len = parts.length - 1;
	var query = parts[len].split("&");
	var array = new Array();

	array['Type'] = parts[len - 2];
	array['item_id'] = parts[len - 1];

	for (var i = 0; i < query.length; i++) {
	    var pairs;
	    if (i == 0) {
	        pairs = query[i].split(".");
	    } else {
	        pairs = query[i].split("=");
	    }

	    array[pairs[0]] = pairs[1];
	}

	return array;
}

var videoJSextension = {

	/*
	 Add our video quality selector button to the videojs controls. This takes
	 a mandatory jQuery object of the <video> element we are setting up the
	 videojs video for.
	 */
	setup_video: function ($video, item, defaults) {

		// Add the stop button.
		_V_.merge(_V_.ControlBar.prototype.options.components, { StopButton: {} });

		var vid_id = $video.attr('id'),
			available_res = ['ultra', 'high', 'medium', 'low'],
			default_res,
			vjs_sources = [], // This will be an array of arrays of objects, see the video.js api documentation for myPlayer.src()
			vjs_source = {},
			vjs_chapters = [], // This will be an array of arrays of objects, see the video.js api documentation for myPlayer.src()
			vjs_chapter = {},
			vjs_languages = [], // This will be an array of arrays of objects, see the video.js api documentation for myPlayer.src()
			vjs_language = {},
			vjs_subtitles = [], // This will be an array of arrays of objects, see the video.js api documentation for myPlayer.src()
			vjs_subtitle = {};

		// Determine this video's default res (it might not have the globally determined default available)
		default_res = available_res[1];

		// Put together the videojs source arrays for each available resolution
		$.each(available_res, function (i, res) {

			vjs_sources[i] = [];

			vjs_source = {};
			vjs_source.res = res;

			vjs_sources[i].push(vjs_source);

		});

		_V_.ResolutionSelectorButton = _V_.ResolutionSelector.extend({
			buttonText: default_res,
			availableRes: vjs_sources
		});

		// Add the resolution selector button.
		_V_.merge(_V_.ControlBar.prototype.options.components, { ResolutionSelectorButton: {} });

		//chceck if chapters exist and add chapter selector
		if (item.Chapters && item.Chapters.length) {
			// Put together the videojs source arrays for each available chapter
			$.each(item.Chapters, function (i, chapter) {

				vjs_chapters[i] = [];

				vjs_chapter = {};
				vjs_chapter.Name = chapter.Name + " (" + ticks_to_human(chapter.StartPositionTicks) + ")";
				vjs_chapter.StartPositionTicks = chapter.StartPositionTicks;

				vjs_chapters[i].push(vjs_chapter);

			});

			_V_.ChapterSelectorButton = _V_.ChapterSelector.extend({
				buttonText: '',
				Chapters: vjs_chapters
			});

			// Add the chapter selector button.
			_V_.merge(_V_.ControlBar.prototype.options.components, { ChapterSelectorButton: {} });
		}


		//chceck if langauges exist and add language selector also subtitles
		if (item.MediaStreams && item.MediaStreams.length) {
			var subCount = 1;
			var langCount = 1;
			var defaultLanguageIndex = defaults.languageIndex || null;
			var defaultSubtitleIndex = defaults.subtitleIndex || 0;

			// Put together the videojs source arrays for each available language and subtitle
			$.each(item.MediaStreams, function (i, stream) {
				var language = stream.Language || '';

				if (stream.Type == "Audio") {
					vjs_languages[i] = [];
					vjs_language = {};

					vjs_language.Name = langCount + ": " + language + " " + stream.Codec + " " + stream.Channels + "ch";
					vjs_language.index = i;

					vjs_languages[i].push(vjs_language);

					if (!defaultLanguageIndex) defaultLanguageIndex = stream.Index;

					langCount++;
				}else if (stream.Type == "Subtitle") {
					vjs_subtitles[i] = [];
					vjs_subtitle = {};

					vjs_subtitle.Name = subCount + ": " + language;
					vjs_subtitle.index = i;

					vjs_subtitles[i].push(vjs_subtitle);

					subCount++;
				}
			});

			if (vjs_languages.length) {

				_V_.LanguageSelectorButton = _V_.LanguageSelector.extend({
					buttonText: vjs_languages[defaultLanguageIndex][0].Name,
					Languages: vjs_languages
				});

				// Add the language selector button.
				_V_.merge(_V_.ControlBar.prototype.options.components, { LanguageSelectorButton: {} });
			}

			if (vjs_subtitles.length) {
				vjs_subtitles[0] = [];
				vjs_subtitles[0].push({Name: "Off", index: ''});
				_V_.SubtitleSelectorButton = _V_.SubtitleSelector.extend({
					buttonText: vjs_subtitles[defaultSubtitleIndex][0].Name,
					Subtitles: vjs_subtitles
				});

				// Add the subtitle selector button.
				_V_.merge(_V_.ControlBar.prototype.options.components, { SubtitleSelectorButton: {} });
			}

		}

	}
};


/*
 JS for the quality selector in video.js player
 */

/*
 Define the base class for the quality selector button.
 Most of this code is copied from the _V_.TextTrackButton
 class.

 https://github.com/zencoder/video-js/blob/master/src/tracks.js#L560)
 */
_V_.ResolutionSelector = _V_.Button.extend({

	kind: "quality",
	className: "vjs-quality-button",

	init: function (player, options) {

		this._super(player, options);

		// Save the starting resolution as a property of the player object
		player.options.currentResolution = this.buttonText;

		this.menu = this.createMenu();

		if (this.items.length === 0) {
			this.hide();
		}
	},

	createMenu: function () {

		var menu = new _V_.Menu(this.player);

		// Add a title list item to the top
		menu.el.appendChild(_V_.createElement("li", {
			className: "vjs-menu-title",
			innerHTML: _V_.uc(this.kind)
		}));

		this.items = this.createItems();

		// Add menu items to the menu
		this.each(this.items, function (item) {
			menu.addItem(item);
		});

		// Add list to element
		this.addComponent(menu);

		return menu;
	},

	// Override the default _V_.Button createElement so the button text isn't hidden
	createElement: function (type, attrs) {

		// Add standard Aria and Tabindex info
		attrs = _V_.merge({
			className: this.buildCSSClass(),
			//innerHTML: '<div><span class="vjs-quality-text">' + this.buttonText + '</span></div>',
			role: "button",
			tabIndex: 0
		}, attrs);

		return this._super(type, attrs);
	},

	// Create a menu item for each text track
	createItems: function () {

		var items = [];

		this.each(this.availableRes, function (res) {

			items.push(new _V_.ResolutionMenuItem(this.player, {

				label: res[0].res,
				src: res
			}));
		});

		return items;
	},

	buildCSSClass: function () {

		return this.className + " vjs-menu-button " + this._super();
	},

	// Focus - Add keyboard functionality to element
	onFocus: function () {

		// Show the menu, and keep showing when the menu items are in focus
		this.menu.lockShowing();
		this.menu.el.style.display = "block";

		// When tabbing through, the menu should hide when focus goes from the last menu item to the next tabbed element.
		_V_.one(this.menu.el.childNodes[this.menu.el.childNodes.length - 1], "blur", this.proxy(function () {

			this.menu.unlockShowing();
		}));
	},

	// Can't turn off list display that we turned on with focus, because list would go away.
	onBlur: function () { },

	onClick: function () {

		/*
		 When you click the button it adds focus, which will show the menu indefinitely.
		 So we'll remove focus when the mouse leaves the button.
		 Focus is needed for tab navigation.
		 */
		this.one('mouseout', this.proxy(function () {

			this.menu.unlockShowing();
			this.el.blur();
		}));
	}
});

/*
 Define the base class for the quality menu items
 */
_V_.ResolutionMenuItem = _V_.MenuItem.extend({

	init: function (player, options) {

		// Modify options for parent MenuItem class's init.
		options.selected = (options.label === player.options.currentResolution);
		this._super(player, options);

		this.player.addEvent('changeRes', _V_.proxy(this, this.update));
	},

	onClick: function () {

		// Check that we are changing to a new quality (not the one we are already on)
		if (this.options.label === this.player.options.currentResolution)
			return;

		var resolutions = new Array();
		resolutions['ultra'] = new Array('webm','mp4','ts','m3u8','ogv');
		resolutions['high'] = new Array('webm','mp4','ts','m3u8','ogv');
		resolutions['medium'] = new Array('webm','mp4','ts','m3u8','ogv');
		resolutions['low'] = new Array('webm','mp4','ts','m3u8','ogv');

		resolutions['ultra']['webm'] = new Array(4000000, 128000, 1920, 1080);
		resolutions['ultra']['mp4'] = new Array(4000000, 128000, 1920, 1080);
		resolutions['ultra']['ts'] = new Array(4000000, 128000, 1920, 1080);
		resolutions['ultra']['m3u8'] = new Array(2500000, 128000, 1920, 1080);
		resolutions['ultra']['ogv'] = new Array(2500000, 128000, 1920, 1080);

		resolutions['high']['webm'] = new Array(2500000, 128000, 1920, 1080);
		resolutions['high']['mp4'] = new Array(2500000, 128000, 1920, 1080);
		resolutions['high']['ts'] = new Array(2500000, 128000, 1920, 1080);
		resolutions['high']['m3u8'] = new Array(1500000, 128000, 1920, 1080);
		resolutions['high']['ogv'] = new Array(1500000, 128000, 1920, 1080);

		resolutions['medium']['webm'] = new Array(1000000, 128000, 1280, 720);
		resolutions['medium']['mp4'] = new Array(1000000, 128000, 1280, 720);
		resolutions['medium']['ts'] = new Array(1000000, 128000, 1280, 720);
		resolutions['medium']['m3u8'] = new Array(750000, 128000, 1280, 720);
		resolutions['medium']['ogv'] = new Array(750000, 128000, 1280, 720);

		resolutions['low']['webm'] = new Array(400000, 128000, 720, 480);
		resolutions['low']['mp4'] = new Array(400000, 128000, 720, 480);
		resolutions['low']['ts'] = new Array(400000, 128000, 720, 480);
		resolutions['low']['m3u8'] = new Array(200000, 128000, 720, 480);
		resolutions['low']['ogv'] = new Array(200000, 128000, 720, 480);

		var currentTime = this.player.currentTime();

		// Set the button text to the newly chosen quality
		jQuery(this.player.controlBar.el).find('.vjs-quality-text').html(this.options.label);

		// Change the source and make sure we don't start the video over
		var currentSrc = this.player.tag.src;
		var src = parse_src_url(currentSrc);
		var newSrc = "/mediabrowser/" + src.Type + "/" + src.item_id + "/stream." + src.stream + "?audioChannels=" + src.audioChannels + "&audioBitrate=" + resolutions[this.options.src[0].res][src.stream][1] +
			"&videoBitrate=" + resolutions[this.options.src[0].res][src.stream][0] + "&maxWidth=" + resolutions[this.options.src[0].res][src.stream][2] + "&maxHeight=" + resolutions[this.options.src[0].res][src.stream][3] +
			"&videoCodec=" + src.videoCodec + "&audioCodec=" + src.audioCodec;

		if (this.player.duration() == "Infinity") {
			if (currentSrc.indexOf("StartTimeTicks") >= 0) {
				var startTimeTicks = currentSrc.match(new RegExp("StartTimeTicks=[0-9]+", "g"));
				var startTime = startTimeTicks[0].replace("StartTimeTicks=", "");

				newSrc += "&StartTimeTicks=" + Math.floor(parseInt(startTime) + (10000000 * currentTime));
			} else {
				newSrc += "&StartTimeTicks=" + Math.floor(10000000 * currentTime);
			}

			this.player.src(newSrc).one('loadedmetadata', function () {
				this.play();
			});
		} else {
			newSrc += "&StartTimeTicks=0";
			this.player.src(newSrc).one('loadedmetadata', function () {
				this.currentTime(currentTime);
				this.play();
			});
		}

		// Save the newly selected resolution in our player options property
		this.player.options.currentResolution = this.options.label;

		// Update the classes to reflect the currently selected resolution
		this.player.triggerEvent('changeRes');
	},

	update: function () {

		if (this.options.label === this.player.options.currentResolution) {
			this.selected(true);
		} else {
			this.selected(false);
		}
	}
});


/*
 JS for the chapter selector in video.js player
 */

/*
 Define the base class for the chapter selector button.
 */
_V_.ChapterSelector = _V_.Button.extend({

	kind: "chapter",
	className: "vjs-chapter-button",

	init: function (player, options) {

		this._super(player, options);

		this.menu = this.createMenu();

		if (this.items.length === 0) {
			this.hide();
		}
	},

	createMenu: function () {

		var menu = new _V_.Menu(this.player);

		// Add a title list item to the top
		menu.el.appendChild(_V_.createElement("li", {
			className: "vjs-menu-title",
			innerHTML: _V_.uc(this.kind)
		}));

		this.items = this.createItems();

		// Add menu items to the menu
		this.each(this.items, function (item) {
			menu.addItem(item);
		});

		// Add list to element
		this.addComponent(menu);

		return menu;
	},

	// Override the default _V_.Button createElement so the button text isn't hidden
	createElement: function (type, attrs) {

		// Add standard Aria and Tabindex info
		attrs = _V_.merge({
			className: this.buildCSSClass(),
			//innerHTML: '<div><span class="vjs-chapter-text">' + this.buttonText + '</span></div>',
			innerHTML: '<div onmouseover="$(\'.vjs-chapter-button\').focus();$(\'.vjs-chapter-button\').click();"></div>',
			role: "button",
			tabIndex: 0
		}, attrs);

		return this._super(type, attrs);
	},

	// Create a menu item for each chapter
	createItems: function () {

		var items = [];

		this.each(this.Chapters, function (chapter) {

			items.push(new _V_.ChapterMenuItem(this.player, {
				label: chapter[0].Name,
				src: chapter
			}));
		});

		return items;
	},

	buildCSSClass: function () {

		return this.className + " vjs-menu-button " + this._super();
	},

	// Focus - Add keyboard functionality to element
	onFocus: function () {

		//find the current chapter and mark it active in the list
		//need to determine current position plus the start point of the file to know where we are.
		var currentTime = this.player.currentTime();
		var startTimeTicks = this.player.tag.src.match(new RegExp("StartTimeTicks=[0-9]+", "g"));
		var nowTicks = Math.floor(parseInt(startTimeTicks[0].replace("StartTimeTicks=","")) + (10000000 * currentTime));

		var activeChapter;
		this.each(this.Chapters, function (chapter) {
			if (nowTicks > chapter[0].StartPositionTicks) {
				activeChapter = chapter[0];
			}
		});
		// Save the newly selected chapter in our player options property
		this.player.options.currentChapter = activeChapter.Name;

		jQuery( this.player.controlBar.el ).find( '.vjs-chapter-button .vjs-menu .vjs-menu-item').removeClass('vjs-selected').each(function(){
			if ($(this).html() == activeChapter.Name) $(this).addClass('vjs-selected');
		});

		// Show the menu, and keep showing when the menu items are in focus
		this.menu.lockShowing();
		this.menu.el.style.display = "block";

		// When tabbing through, the menu should hide when focus goes from the last menu item to the next tabbed element.
		_V_.one(this.menu.el.childNodes[this.menu.el.childNodes.length - 1], "blur", this.proxy(function () {

			this.menu.unlockShowing();
		}));
	},


	// Can't turn off list display that we turned on with focus, because list would go away.
	onBlur: function () { },

	onClick: function () {

		/*
		 When you click the button it adds focus, which will show the menu indefinitely.
		 So we'll remove focus when the mouse leaves the button.
		 Focus is needed for tab navigation.
		 */
		this.one('mouseout', this.proxy(function () {

			this.menu.unlockShowing();
			this.el.blur();
		}));
	}
});

/*
 Define the base class for the chapter menu items
 */
_V_.ChapterMenuItem = _V_.MenuItem.extend({

	init: function (player, options) {

		// Modify options for parent MenuItem class's init.
		//options.selected = ( options.label === player.options.currentResolution );
		this._super(player, options);

		this.player.addEvent('changeChapter', _V_.proxy(this, this.update));
	},

	onClick: function () {

		// Set the button text to the newly chosen chapter
		//jQuery( this.player.controlBar.el ).find( '.vjs-chapter-text' ).html( this.options.label );

	    if (this.player.duration() == "Infinity") {
	        
			var currentSrc = this.player.tag.src;

			var newSrc;
		    
			if (currentSrc.indexOf("StartTimeTicks") >= 0) {
				newSrc = currentSrc.replace(new RegExp("StartTimeTicks=[0-9]+", "g"), "StartTimeTicks=" + this.options.src[0].StartPositionTicks);
			} else {
				newSrc = currentSrc + "&StartTimeTicks=" + this.options.src[0].StartPositionTicks;
			}

			this.player.src(newSrc).one('loadedmetadata', function () {
				this.play();
			});
		} else {
			//figure out the time from ticks
			var currentTime = parseFloat(this.options.src[0].StartPositionTicks) / 10000000;

			this.player.currentTime(currentTime);
		}

		// Save the newly selected chapter in our player options property
		this.player.options.currentChapter = this.options.label;

		// Update the classes to reflect the currently selected chapter
		this.player.triggerEvent('changeChapter');
	},

	update: function () {
		if (this.options.label === this.player.options.currentChapter) {
			this.selected(true);
		} else {
			this.selected(false);
		}
	}
});

/*
 JS for the stop button in video.js player
 */

/*
 Define the base class for the stop button.
 */

_V_.StopButton = _V_.Button.extend({

	kind: "stop",
	className: "vjs-stop-button",

	init: function (player, options) {

		this._super(player, options);

	},

	buildCSSClass: function () {

		return this.className + " vjs-menu-button " + this._super();
	},

	onClick: function () {
		MediaPlayer.stop();
	}
});

/*
 JS for the subtitle selector in video.js player
 */

/*
 Define the base class for the subtitle selector button.
 */
_V_.SubtitleSelector = _V_.Button.extend({

	kind: "subtitle",
	className: "vjs-subtitle-button",

	init: function (player, options) {

		this._super(player, options);

		// Save the starting subtitle track as a property of the player object
		player.options.currentSubtitle = this.buttonText;

		this.menu = this.createMenu();

		if (this.items.length === 0) {
			this.hide();
		}
	},

	createMenu: function () {

		var menu = new _V_.Menu(this.player);

		// Add a title list item to the top
		menu.el.appendChild(_V_.createElement("li", {
			className: "vjs-menu-title",
			innerHTML: _V_.uc(this.kind)
		}));

		this.items = this.createItems();

		// Add menu items to the menu
		this.each(this.items, function (item) {
			menu.addItem(item);
		});

		// Add list to element
		this.addComponent(menu);

		return menu;
	},

	// Override the default _V_.Button createElement so the button text isn't hidden
	createElement: function (type, attrs) {

		// Add standard Aria and Tabindex info
		attrs = _V_.merge({
			className: this.buildCSSClass(),
			//innerHTML: '<div><span class="vjs-chapter-text">' + this.buttonText + '</span></div>',
			role: "button",
			tabIndex: 0
		}, attrs);

		return this._super(type, attrs);
	},

	// Create a menu item for each subtitle
	createItems: function () {

		var items = [];

		this.each(this.Subtitles, function (subtitle) {
			if (subtitle && subtitle.length) {
				items.push(new _V_.SubtitleMenuItem(this.player, {
					label: subtitle[0].Name,
					src: subtitle
				}));
			}
		});

		return items;
	},

	buildCSSClass: function () {

		return this.className + " vjs-menu-button " + this._super();
	},

	// Focus - Add keyboard functionality to element
	onFocus: function () {

		// Show the menu, and keep showing when the menu items are in focus
		this.menu.lockShowing();
		this.menu.el.style.display = "block";

		// When tabbing through, the menu should hide when focus goes from the last menu item to the next tabbed element.
		_V_.one(this.menu.el.childNodes[this.menu.el.childNodes.length - 1], "blur", this.proxy(function () {

			this.menu.unlockShowing();
		}));
	},


	// Can't turn off list display that we turned on with focus, because list would go away.
	onBlur: function () { },

	onClick: function () {

		/*
		 When you click the button it adds focus, which will show the menu indefinitely.
		 So we'll remove focus when the mouse leaves the button.
		 Focus is needed for tab navigation.
		 */
		this.one('mouseout', this.proxy(function () {

			this.menu.unlockShowing();
			this.el.blur();
		}));
	}
});

/*
 Define the base class for the subtitle menu items
 */
_V_.SubtitleMenuItem = _V_.MenuItem.extend({

	init: function (player, options) {

		// Modify options for parent MenuItem class's init.
		options.selected = ( options.label === player.options.currentSubtitle );
		this._super(player, options);

		this.player.addEvent('changeSubtitle', _V_.proxy(this, this.update));
	},

	onClick: function () {

		// Check that we are changing to a new subtitle (not the one we are already on)
		if (this.options.label === this.player.options.currentSubtitle)
			return;

		var currentTime = this.player.currentTime();

		// Set the button text to the newly chosen subtitle
		jQuery(this.player.controlBar.el).find('.vjs-quality-text').html(this.options.label);

		// Change the source and make sure we don't start the video over
		var currentSrc = this.player.tag.src;
		var src = parse_src_url(currentSrc);

		var newSrc = "/mediabrowser/" + src.Type + "/" + src.item_id + "/stream." + src.stream + "?audioChannels=" + src.audioChannels + "&audioBitrate=" + src.audioBitrate +
			"&videoBitrate=" + src.videoBitrate + "&maxWidth=" + src.maxWidth + "&maxHeight=" + src.maxHeight +
			"&videoCodec=" + src.videoCodec + "&audioCodec=" + src.audioCodec +
			"&AudioStreamIndex=" + src.AudioStreamIndex + "&SubtitleStreamIndex=" + this.options.src[0].index;

		if (this.player.duration() == "Infinity") {
			if (currentSrc.indexOf("StartTimeTicks") >= 0) {
				var startTimeTicks = currentSrc.match(new RegExp("StartTimeTicks=[0-9]+", "g"));
				var startTime = startTimeTicks[0].replace("StartTimeTicks=", "");

				newSrc += "&StartTimeTicks=" + Math.floor(parseInt(startTime) + (10000000 * currentTime));
			} else {
				newSrc += "&StartTimeTicks=" + Math.floor(10000000 * currentTime);
			}

			this.player.src(newSrc).one('loadedmetadata', function () {
				this.play();
			});
		} else {
			newSrc += "&StartTimeTicks=0";
			this.player.src(newSrc).one('loadedmetadata', function () {
				this.currentTime(currentTime);
				this.play();
			});
		}


		// Save the newly selected subtitle in our player options property
		this.player.options.currentSubtitle = this.options.label;

		// Update the classes to reflect the currently selected subtitle
		this.player.triggerEvent('changeSubtitle');
	},

	update: function () {
		if (this.options.label === this.player.options.currentSubtitle) {
			this.selected(true);
		} else {
			this.selected(false);
		}
	}
});

/*
 JS for the language selector in video.js player
 */

/*
 Define the base class for the language selector button.
 */
_V_.LanguageSelector = _V_.Button.extend({

	kind: "Audio",
	className: "vjs-language-button",

	init: function (player, options) {

		this._super(player, options);

		// Save the starting language as a property of the player object
		player.options.currentLanguage = this.buttonText;

		this.menu = this.createMenu();

		if (this.items.length === 0) {
			this.hide();
		}
	},

	createMenu: function () {

		var menu = new _V_.Menu(this.player);

		// Add a title list item to the top
		menu.el.appendChild(_V_.createElement("li", {
			className: "vjs-menu-title",
			innerHTML: _V_.uc(this.kind)
		}));

		this.items = this.createItems();

		// Add menu items to the menu
		this.each(this.items, function (item) {
			menu.addItem(item);
		});

		// Add list to element
		this.addComponent(menu);

		return menu;
	},

	// Override the default _V_.Button createElement so the button text isn't hidden
	createElement: function (type, attrs) {

		// Add standard Aria and Tabindex info
		attrs = _V_.merge({
			className: this.buildCSSClass(),
			//innerHTML: '<div><span class="vjs-chapter-text">' + this.buttonText + '</span></div>',
			role: "button",
			tabIndex: 0
		}, attrs);

		return this._super(type, attrs);
	},

	// Create a menu item for each subtitle
	createItems: function () {

		var items = [];

		this.each(this.Languages, function (language) {
			if (language && language.length) {
				items.push(new _V_.LanguageMenuItem(this.player, {
					label: language[0].Name,
					src: language
				}));
			}
		});

		return items;
	},

	buildCSSClass: function () {

		return this.className + " vjs-menu-button " + this._super();
	},

	// Focus - Add keyboard functionality to element
	onFocus: function () {

		// Show the menu, and keep showing when the menu items are in focus
		this.menu.lockShowing();
		this.menu.el.style.display = "block";

		// When tabbing through, the menu should hide when focus goes from the last menu item to the next tabbed element.
		_V_.one(this.menu.el.childNodes[this.menu.el.childNodes.length - 1], "blur", this.proxy(function () {

			this.menu.unlockShowing();
		}));
	},


	// Can't turn off list display that we turned on with focus, because list would go away.
	onBlur: function () { },

	onClick: function () {

		/*
		 When you click the button it adds focus, which will show the menu indefinitely.
		 So we'll remove focus when the mouse leaves the button.
		 Focus is needed for tab navigation.
		 */
		this.one('mouseout', this.proxy(function () {

			this.menu.unlockShowing();
			this.el.blur();
		}));
	}
});

/*
 Define the base class for the language menu items
 */
_V_.LanguageMenuItem = _V_.MenuItem.extend({

	init: function (player, options) {

		// Modify options for parent MenuItem class's init.
		options.selected = ( options.label === player.options.currentLanguage );
		this._super(player, options);

		this.player.addEvent('changeLanguage', _V_.proxy(this, this.update));
	},

	onClick: function () {

		// Check that we are changing to a new language (not the one we are already on)
		if (this.options.label === this.player.options.currentLanguage)
			return;

		// Change the source and make sure we don't start the video over
		var currentTime = this.player.currentTime();
		var currentSrc = this.player.tag.src;
		var src = parse_src_url(currentSrc);

		var newSrc = "/mediabrowser/" + src.Type + "/" + src.item_id + "/stream." + src.stream + "?audioChannels=" + src.audioChannels + "&audioBitrate=" + src.audioBitrate +
			"&videoBitrate=" + src.videoBitrate + "&maxWidth=" + src.maxWidth + "&maxHeight=" + src.maxHeight +
			"&videoCodec=" + src.videoCodec + "&audioCodec=" + src.audioCodec +
			"&AudioStreamIndex=" + this.options.src[0].index + "&SubtitleStreamIndex=" + src.SubtitleStreamIndex;

		if (this.player.duration() == "Infinity") {
			if (currentSrc.indexOf("StartTimeTicks") >= 0) {
				var startTimeTicks = currentSrc.match(new RegExp("StartTimeTicks=[0-9]+", "g"));
				var startTime = startTimeTicks[0].replace("StartTimeTicks=", "");

				newSrc += "&StartTimeTicks=" + Math.floor(parseInt(startTime) + (10000000 * currentTime));
			} else {
				newSrc += "&StartTimeTicks=" + Math.floor(10000000 * currentTime);
			}

			this.player.src(newSrc).one('loadedmetadata', function () {
				this.play();
			});
		} else {
			newSrc += "&StartTimeTicks=0";
			this.player.src(newSrc).one('loadedmetadata', function () {
				this.currentTime(currentTime);
				this.play();
			});
		}

		// Save the newly selected language in our player options property
		this.player.options.currentLanguage = this.options.label;

		// Update the classes to reflect the currently selected language
		this.player.triggerEvent('changeLanguage');
	},

	update: function () {
		if (this.options.label === this.player.options.currentLanguage) {
			this.selected(true);
		} else {
			this.selected(false);
		}
	}
});