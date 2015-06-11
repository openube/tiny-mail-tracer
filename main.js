'use strict';
(function(){
	
function ready(fn) {
	if (document.readyState != 'loading'){
		fn();
	} else {
		document.addEventListener('DOMContentLoaded', fn);
	}
}

var ext_core = {
	repeat : 7,
	timeout : 2000,
	tracks_nmbs :  [],
	tracks_index :  {},
	tmp_tracks_labels : undefined,
	tracks_labels : [],
	info_placehoders : {},
	chache_info : {},
	random_nmb : Math.floor(Math.random() * 100000000000).toString(),
	general_url : 'https://www.17track.net/en/result/post.shtml?nums=',
	link_class : 'ext17t-link',
	_now : (new Date()).valueOf(),
	_one_hour : 3600000,
	_old_cache : 5184000000, // 1000 * 60 * 60 * 24 * 60 : miliseconds * seconds * minutes * hours * days  : 60 days

	init : function(){
		var doc_frag;
		var placeholder_div;
		var svg_loader;
		this.random_nmb = this.random_nmb + this.random_nmb;
		this.svg_loader = document.createDocumentFragment();
		placeholder_div = document.createElement('div');
		placeholder_div.classList.add('ext17t-placeholder');
		svg_loader = document.createElement('img');
		svg_loader.setAttribute('src', chrome.extension.getURL('svg/puff.svg'));
		placeholder_div.appendChild(svg_loader);
		this.svg_loader.appendChild(placeholder_div);
		this.open_link = this.open_link_fabric();
	},

	check_new_numbers : function() {
		var i;
		var len;
		var nmb;
		
		this.tmp_tracks_labels = document.getElementsByClassName('tracking-label');

		for (i = 0, len = this.tmp_tracks_labels.length; i < len; i++) {
			if (this.tmp_tracks_labels[i].getAttribute('data-skip') === 'true') {
				continue;
			}
			this.tmp_tracks_labels[i].setAttribute('data-skip', 'true')
			nmb = this.tmp_tracks_labels[i].getElementsByTagName('a');
			if (nmb.length === 0){
				continue;
			}
			nmb = nmb[0].textContent.replace('Tracking number','');
			
			if (this.tracks_index.hasOwnProperty(nmb)) {
				continue;
			}
			this.tracks_labels.push(this.tmp_tracks_labels[i]);
			this.tracks_nmbs.push(nmb);
			this.tracks_index[nmb] = i;	
			this.info_placehoders[nmb] = this.tmp_tracks_labels[i].appendChild(this.svg_loader.childNodes[0].cloneNode(true));
			
			chrome.storage.local.get(['ts_' + nmb, 'cache_' + nmb], this.cache_processor(this));
		}

		this.repeat--;

		if (this.repeat > 0){
			window.setTimeout(this.check_new_numbers.bind(this), this.timeout);
		}
	},
	
	cache_processor : function(object_ptr) {
		return function(result) {
			// chrome.storage.local.get callback
			// next line hack to get number from callback
			var nmb = this.args[1][0].slice(3); 

			var cache_value;
			var timestamp = result['ts_' + nmb];
			var info;
			var must_be = ['date', 'location'];
			var i;
			var len;
			
			if (timestamp === undefined) {
				object_ptr.handle_cache_result('not in cache', nmb);
				return;
			}

			cache_value = result['cache_' + nmb];
			info = JSON.parse(cache_value);

			for (i = 0, len = must_be.length; i < len; i++) {
				if (!info.hasOwnProperty(must_be[i])) {
					object_ptr.handle_cache_result('not in cache', nmb);
					return;
				}

				if (!info[must_be[i]].length > 0){
					object_ptr.handle_cache_result('not in cache', nmb);
					return;
				}
			}

			if (object_ptr._now - Number(timestamp) >= object_ptr._one_hour) {
				object_ptr.handle_cache_result('ok, but outdated', nmb, info);
				return;
			}

			object_ptr.handle_cache_result('ok', nmb, info);
			return;

		};
	},

	handle_cache_result: function (result, nmb, info) {
		switch(result) {
		case 'ok':
			this.chache_info[nmb] = info;
			this.display_info(nmb, info);
		break;
		case 'not in cache':
			this.get_info(nmb);
		break;
		case 'ok, but outdated':
			this.chache_info[nmb] = info;
			this.get_info(nmb, true);
		break;
		}
	},

	display_info: function (nmb, info, from_cache){
		var i = this.tracks_index[nmb];
		var label = this.tracks_labels[i];
		var doc_frag;
		var new_div;
		var span;
		var link;
		var link_img;
		var link_span
		var 

		doc_frag = document.createDocumentFragment();
		new_div = document.createElement('div');
		span = document.createElement('span');


		if (info === undefined){
			span.innerText = 'Can\'t find any info about this track number, try to relod page after a few minutes.';
			new_div.appendChild(span);
			doc_frag.appendChild(new_div);
			this.info_placehoders[nmb].remove();
			new_div = label.appendChild(doc_frag.childNodes[0].cloneNode(true));
			return;
		}
		
		if (from_cache) {
			span.innerText = info.date + ' : ' + info.location + 'from cache ' ;
		}

		span.innerText = info.date + ' : ' + info.location + ' ' ;
		
		new_div.appendChild(span);
		link = document.createElement('a');

		link_img = document.createElement('img');
		link_img.classList.add(this.link_class);
		link_img.setAttribute('src', chrome.extension.getURL('svg/link.svg'));
		link_img.setAttribute('alt', 'Show info in new tab');
		link_img.setAttribute('height', '12');
		link_img.setAttribute('width', '12');
		link.appendChild(link_img);
		span = document.createElement('span');
		span.appendChild(link);
		new_div.appendChild(span);
		doc_frag.appendChild(new_div);

		this.info_placehoders[nmb].remove();
		new_div = label.appendChild(doc_frag.childNodes[0].cloneNode(true));
		new_div.addEventListener('click', this.open_link);
	},

	get_info: function(nmb) {
		var tracking_url = 'https://www.17track.net/r/handlertrack.ashx?callback=jQuery';
		var divide_param = '_';
		var num_param = '&num=';
		var additional_params = '&pt=0&cm=0&cc=0&_='; 

		var request = new XMLHttpRequest();
		request.withCredentials = false;
		request.timeout = 120000;
		request.__nmb = nmb;
		request.handle_response = this.handle_response;
		request.__trash_replace =  ['jQuery', this.random_nmb, '_', (this._now - 1).toString(), '('].join('');
		request.__object_ptr = this;
		
		var url = [
			tracking_url ,
			this.random_nmb ,
			divide_param ,
			(this._now - 1).toString() ,
			num_param ,
			nmb ,
			additional_params ,
			this._now.toString()
		];

		request.open('GET', url.join(''), true);

		request.onload = function() {
			var new_info = {};
			var response_json;
			if (this.status >= 200 && this.status < 400) {
				response_json = this.response.replace(this.__trash_replace, '').slice(0,-1);
				response_json = JSON.parse(response_json);
				this.handle_response.call(request.__object_ptr, 'ok', this.__nmb, response_json);
			} else {
				this.handle_response.call(request.__object_ptr, 'error', this.__nmb, response_json);
			}
		};

		request.onerror = function() {
			this.handle_response.call(request.__object_ptr, 'connection error', this.__nmb);
		};

		request.send();
	},
	

	handle_response : function(result, nmb, response_json) {
		var new_info = {};
		switch(result){
		case 'ok':
			if (response_json.dat.ylt1 === '2079-01-01 00:00:00') {
				this.handle_new_info('wrong json', nmb);
				return;	
			}

			new_info.date = this.escape(response_json.dat.z0.a);
			new_info.location = this.escape(response_json.dat.z0.c);
			if (new_info.location.length === 0){
				new_info.location = this.escape(response_json.dat.z0.d);
			}
			if (new_info.location.length === 0){
				new_info.location = this.escape(response_json.dat.z0.z);
			}
			nmb = this.escape(response_json.dat.a);
			
			this.handle_new_info('ok', nmb, new_info);

		break;
		case 'error':
		case 'connection error':
			this.handle_new_info('from cache', nmb, response_json)
		break;
		}
	},

	handle_new_info: function (state, nmb, info){
		switch(state){
		case 'ok':
			this.save_to_cache(nmb, info);
			this.display_info(nmb, info);
		break;
		case 'wrong json':
		case 'from cache':
			this.display_info(nmb, this.chache_info[nmb], true);
		break;
		}
	}, 

	escape : function(unsafe_str) {
		return unsafe_str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	},
	open_link_fabric : function() {
		var ext_core  = this;
		return function(event) {
			var url;
			if (event.target.classList.contains(ext_core.link_class)){
				event.preventDefault();
				event.stopPropagation();
				url = ext_core.general_url + ext_core.tracks_nmbs.join('%2C');
				window.open(url, '_blank');
			}
		}; 
	},
	save_to_cache : function(nmb, info) {
		if (info === undefined) {
			return;
		}
		var ts_key = 'ts_' + nmb.toString();
		var cache_key = 'cache_' + nmb.toString(); 
		var save_set = {};
		save_set[ts_key] = this._now;
		save_set[cache_key] = JSON.stringify(info);
		chrome.storage.local.set(save_set);
	},
	cleanup_cache : function() {
		function _cleanup_cache(items) {
			var items_keys = Object.keys(items);
			var i;
			var len;
			var to_delete = [];
			var nmb;
			for (i = 0, len = items_keys.length; i < len; i++) {
				if (items_keys[i].slice(0,3) !== 'ts_') {
					continue;
				}

				if (( this._now - Number(items[items_keys[i]])) >= this._old_cache) {
					nmb = items_keys[i].slice(3);

					to_delete.push('ts_' + nmb);
					to_delete.push('cache_' + nmb);
				}
			}
			chrome.storage.local.remove(to_delete);
		}	
		chrome.storage.local.get(null, _cleanup_cache);
	}
};

ready(function(){
	ext_core.init();
	ext_core.cleanup_cache();
	window.setTimeout(ext_core.check_new_numbers.bind(ext_core), ext_core.timeout);
});

})();
