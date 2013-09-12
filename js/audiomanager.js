

function AudioSource(opts) {
	if (!opts) opts = {};
	this.id = opts.myid;
	this.generator = opts.generator;
	this.channels  = opts.channels || 2;				// We'll support 1 or 2 here only
	this.bufsize   = opts.bufsize;					// match buffer to upstream in terms of stereo output
	this.buflength = this.bufsize * this.channels;
	this.buffer = new Array(this.buflength);
	this.setGain(opts.gain || 0);
};

AudioSource.prototype.setGain = function(gainl, gainr) {
	this.gain_l = gainl;
	this.gain_r = gainr || gainl;
	this.gain_factor_l = Math.pow(10.0, (this.gain_l - 3.0) / 20.0);
	this.gain_factor_r = Math.pow(10.0, (this.gain_r - 3.0) / 20.0);
}

AudioSource.prototype.fill = function(samples) {
	this.generator.generateIntoBuffer(samples, this.buffer, 0);

	//console.log("AudioSource fill: generating", samples, "samples");
	// fill w/ zeros
	if(this.buffer.length < samples * this.channels) {
		var start = this.buffer.length;
		var end = samples * this.channels;
		for (var i = start; i <= end; i++) {
			this.buffer[i] = 0;
		}
		if(this.generator.ready) {
			console.log("WARN: AudioSource still ready after shorting buffer full");
		}
	}

	// Stereoize if needed
	if(this.channels == 1) {
		var idx_m = samples - 1;		// do it backwards so it can be done in-buffer
		var idx_s = samples * 2 - 1;
		while(idx_m >= 0) {
			var s = this.buffer[idx_m];
			this.buffer[idx_s] = s;
			this.buffer[idx_s - 1] = s;
			idx_s -= 2;
			idx_m--;
		}
	}
}

function AudioMixer(opts) {
	if (!opts) opts = {};
	this.channels = 2;					// mixer hardcoded to two channels
	this.mixrate = opts.mixrate;
	this.bufsize = opts.bufsize;
	this.buflength = opts.bufsize * 2;
	this.setGain(0);
	this.state = AudioMixer.state.running;
	this.buffer = null;					// record of last generated buffer

	this.next_src_id = 0;

	this.sources = {};
	this.active_sources = [];

	// FIXME: this is in for compatability for the moment
	this.finished = false;
};

AudioMixer.state = Object.freeze({ running:{}, idle:{} });

AudioMixer.prototype.setGain = function(gainl, gainr) {
	this.gain_l = gainl;
	this.gain_r = gainr || gainl;
	this.gain_factor_l = Math.pow(10.0, (this.gain_l + 3.0) / 20.0);
	this.gain_factor_r = Math.pow(10.0, (this.gain_r + 3.0) / 20.0);
}

AudioMixer.prototype.addSource = function(generator) {
	var newid = this.next_src_id++;
	console.log("adding audio source/generator, new ID: ", newid);
	this.sources[newid] = new AudioSource({
		myid: newid,
		generator: generator,
		bufsize: this.bufsize, 
		mixrate: this.mixrate
	});		
	return newid;
};

AudioMixer.prototype.delSource = function(id) {
	// FIXME: should signal to the source we're taking the patch away or something like that
	delete this.sources[id];
};

AudioMixer.prototype.scan_active = function() {
	var active = [];
	for(var s in this.sources) {
		if(this.sources[s].generator.ready ) {
			active.push(s);
		}
	}	
	this.active_sources = active;
	if(active.length > 0) {
		this.state = AudioMixer.state.running;
		return true;
	}
	this.state = AudioMixer.state.idle;
	return false;
}

// new generator
AudioMixer.prototype.generate = function(samples) {
	this.scan_active();

	if(this.active_sources.length == 0) return null;
	for(var s in this.active_sources) {
		this.sources[s].fill(samples);
	}

	var buf = new Array(samples * 2);
	var idx = 0;
	for( var i = 0; i < samples; i++ ) {
		var l=0,r=0;
		for(var s in this.active_sources) {
			var src = this.sources[s];
			l += src.buffer[idx] * src.gain_factor_l;
			r += src.buffer[idx+1] * src.gain_factor_r;
		}
		// apply master gain and clip to output buffer
		buf[idx++] = Math.min(1.0, Math.max(-1.0, l * this.gain_factor_l));
		buf[idx++] = Math.min(1.0, Math.max(-1.0, r * this.gain_factor_r));
	}
	// kept mostly for inspection
	this.buffer = buf;
	return buf;
}


////////////////// AudioManager

function AudioManager(opts) {
	//if (!opts) opts = {};
	this.latency = 1000;
	this.checkInterval = this.latency / 10; 						// in ms
	this.channels = 2;					// for now, all we support (possibly forever)
	this.sampleBufferSize = 16384;
	this.sampleBufferLength = 32768;
	this.state = AudioManager.state.idle;
	this.last_state = AudioManager.state.idle;
	// hard-coded in Flash player, webKit usually overrides this to 48000 in detect
	this.sampleRate = 44100;
	this.detectMode();
	this.mixer = new AudioMixer({
		bufsize: this.sampleBufferSize,
		mixrate: this.sampleRate
	})
	this.monitor();
}

AudioManager.state = Object.freeze({ running:{}, idle:{}, shutdown:{} });

AudioManager.INSTANCE = null;
AudioManager.get = function() {
	if(AudioManager.INSTANCE == null) {
		AudioManager.INSTANCE = new AudioManager();
	} 
	return AudioManager.INSTANCE
}

AudioManager.mode = Object.freeze({ firefox:{}, webkit:{}, flash:{} });

AudioManager.prototype.detectMode = function() {
	var audioElement = new Audio();
	if (audioElement.mozSetup) {
		this.mode = AudioManager.mode.firefox;
		this.audioElement = audioElement;
		audioElement.mozSetup(this.channels, this.sampleRate);
		// other vars related to this backend
		this.buffer = []; /* data generated but not yet written */
		this.ff_minBufferLength = Math.floor(this.latency * this.sampleRate * 2 / 1000);			// low samples mark
		this.bufferFillLength = Math.floor(this.latency * this.sampleRate / 1000);
		return this.mode;
	}
	var webkitAudio = window.AudioContext || window.webkitAudioContext;
	if (webkitAudio) {
		this.mode = AudioManager.mode.webkit;
		this.webkitAudioContext = new webkitAudio();
		this.sampleRate = this.webkitAudioContext.sampleRate;
		this.bufferFillLength = 16384;
		this.node = this.webkitAudioContext.createJavaScriptNode(this.sampleBufferSize, 0, this.channels);
		var that = this;
		this.node.onaudioprocess = function(e) { that.webkitProcess(e) };
		return this.mode;
	}
	// Fall back to creating flash player
	this.mode = AudioManager.mode.flash;
	this.bufferFillLength = Math.floor(this.latency * this.sampleRate / 1000);
	var c = document.createElement('div');
	c.innerHTML = '<embed type="application/x-shockwave-flash" id="da-swf" src="da.swf" width="8" height="8" allowScriptAccess="always" style="position: fixed; left:-10px;" />';
	//var bodynode = document.getElementsByTagName('body')[0];
	document.body.appendChild(c);
	this.swf = document.getElementById('da-swf');
	return this.mode;

};

AudioManager.prototype.shutdown = function() {
	this.state = AudioManager.state.shutdown;
};

AudioManager.prototype.monitor = function() {
	var that = this;

	// disconnect things if transitioning out of running state
	if(this.state != AudioManager.state.running && this.last_state == AudioManager.state.running) {
		switch (this.mode) {
			case AudioManager.mode.webkit:
				this.node.disconnect();
				break;
			case AudioManager.mode.flash:
				this.swf.stop();
				break;
		}
	} 
	if(this.state == AudioManager.state.shutdown) {
		return;		 // break out of monitor by returning without reschedule
	}
	
	if(this.state == AudioManager.state.idle) {
		if(this.mixer.scan_active()) {
			this.state = AudioManager.state.running;
		}
	}

	if(this.state == AudioManager.state.running) {
		// check if we need to connect things
		if(this.last_state != AudioManager.state.running) {
			console.log("starting audio");
			switch (this.mode) {
				case AudioManager.mode.webkit:
					this.node.connect(this.webkitAudioContext.destination);
					break;
				case AudioManager.mode.flash:
					this.swf.start();
					break;
			}
		}

		// all up and running

		switch (this.mode) {
			case AudioManager.mode.firefox:
				if (this.buffer.length) {
					var written = this.audioElement.mozWriteAudio(this.buffer);
					this.buffer = this.buffer.slice(written);
				}
				if (this.buffer.length < this.ff_minBufferLength && !this.mixer.finished) {
					this.buffer = this.buffer.concat(this.mixer.generate(this.bufferFillLength));
				}
				break;
			case AudioManager.mode.flash:
				if (this.swf.write && this.swf.bufferedDuration() < this.latency) {
					var data = this.mixer.generate(this.bufferFillLength);
					var out = new Array(data.length);
					for (var i = data.length-1; i != 0; i--) {
						out[i] = Math.floor(data[i]*32768);
					}
					this.swf.write(out.join(' '));
				}
				break;
		}
	} 

	this.last_state = this.state;

	// go idle if mixer is
	if (this.mixer.state == AudioMixer.state.idle) {
		this.state = AudioManager.state.idle;
	}

	// reschedule
	setTimeout(function() { that.monitor() }, that.checkInterval);
};

AudioManager.prototype.webkitProcess = function(e) {
	// FIXME. This shouldn't be controlled by the mixer I think.
	if ( this.state == AudioManager.state.idle ) {
		//this.node.disconnect();
		return;
	}
			
	var dataLeft = e.outputBuffer.getChannelData(0);
	var dataRight = e.outputBuffer.getChannelData(1);

	var generate = this.mixer.generate(this.sampleBufferSize);
	//console.log("webkit process: generated", generate.length, "samples");

	for (var i = 0; i < (generate.length / 2); ++i) {
		dataLeft[i] = generate[i*2];
		dataRight[i] = generate[i*2+1];
	}
	
}

