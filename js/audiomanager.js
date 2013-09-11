

function AudioSource(opts) {
	if (!opts) opts = {};
	this.id = opts.myid;
	this.state = AudioSource.state.enabled;
	this.generator = opts.generator;
	this.channels = opts.channels || 2;				// We'll support 1 or 2 here only
	this.bufsize = opts.bufsize;		// match buffer to upstream in terms of stereo output
	this.buflength= this.bufsize * this.channels;
	this.mixrate = opts.mixrate;
	this.buffer = new Array();
	this.setGain(opts.gain || 0);
};

AudioSource.state = new Object({ 
	enabled: {},			// normal running
	disabled: {},			// "paused"
	killed: {},			// dead but still flushing samples
	zombie: {}			// completely dead, ready to be reaped
});

AudioSource.prototype.setGain = function(gainl, gainr) {
	this.gain_l = gainl;
	this.gain_r = gainr || gainl;
	this.gain_factor_l = Math.pow(10.0, (this.gain_l - 3.0) / 20.0);
	this.gain_factor_r = Math.pow(10.0, (this.gain_r - 3.0) / 20.0);
}

AudioSource.prototype.fillBuffer = function() {
	//console.log("AudioSource fillBuffer: buffer max size: ", this.bufsize , ", buffer length: ", this.buffer.length);
	if(this.buffer.length < this.buflength && !this.generator.finished) {
		//var samplesToGenerate = this.bufsize - (this.buffer.length / this.channels);
		var samplesToGenerate = this.bufsize;
		//console.log("AudioSource fillBuffer: generating ", samplesToGenerate, "samples, buffer length: ", this.buffer.length);

		//var newsamp = this.generator.generate(samplesToGenerate);
		//var newsamp = this.generator.generateIntoBuffer(samplesToGenerate, this.buffer, this.buffer.length);
		//this.buffer = this.buffer.concat(newsamp);
		this.generator.generateIntoBuffer(samplesToGenerate, this.buffer, this.buffer.length);
		//console.log("AudioSource fillBuffer: after buffer length: ", this.buffer.length);
	} 
	if (this.generator.finished) {
		this.state = AudioSource.state.killed;
	}
}

AudioSource.prototype.takeSample = function() {
	if(this.state == AudioSource.state.disabled) {
		console.log("AudioSource takeSample: bailing due to disabled");
		return([0.0,0.0]);
	}

	//console.log("AudioSource takeSample entry: buffer length: ", this.buffer.length)
	// fill if empty
	if(this.buffer.length < this.channels) {
		if(this.state == AudioSource.state.enabled) {
			//console.log("AudioSource takeSample: filling buffer")
			this.fillBuffer();
		} else if(this.state == AudioSource.state.killed) {
			// transition to the undead
			this.state = AudioSource.state.zombie;
			console.log("AudioSource takeSample: bailing due to ZOMBIES");
			return([0.0,0.0]);
		}
		// if *still* empty or insufficient samples
		if(this.buffer.length < this.channels) {
			//console.log("AudioSource takeSample: flagging zombie")
			// idle... how to set this in state? not a zombie.
			//this.state = AudioSource.state.zombie;
			console.log("AudioSource takeSample: bailing due to inability to fill buffer");
			return([0.0,0.0]);
		}
	}
	//console.log("AudioSource takeSample: buffer length: ", this.buffer.length)
	// at least one sample available
	//if(this.buffer.length >= this.channels)
	var left = this.buffer.shift();
	var right;
	if(this.channels == 1) {
		right = left;
	} else {
		right = this.buffer.shift();
	}
	// does not clip. cliping handled at the end
	return([left * this.gain_factor_l, right * this.gain_factor_r]);
}

function AudioMixer(opts) {
	if (!opts) opts = {};
	this.channels = 2;					// mixer hardcoded to two channels
	this.mixrate = opts.mixrate;
	this.bufsize = opts.bufsize;
	this.buflength = opts.bufsize * 2;
	this.setGain(0);
	this.state = AudioMixer.state.idle;
	this.buffer = new Array();

	this.next_src_id = 0;
	this.sources = {};

	// FIXME: this is in for compatability for the moment
	this.finished = false;
};

// FIXME: paused not used, state is read only between running and idle detection for now
AudioMixer.state = Object.freeze({ running:{}, idle:{}, paused:{} });

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

AudioMixer.prototype.fillBuffer = function() {
	// do some maintenance and skip idle source up front
	var active_sources = [];
	for(var s in this.sources) {
		if(this.sources[s].state == AudioSource.state.zombie) {
			console.log("ZOMBIE DESTROY");
			this.delSource(s);
		} else if(this.sources[s].state != AudioSource.state.disabled && this.sources[s].generator.ready ) {
			active_sources.push(s);
		}
	}	
	if(this.buffer.length < this.buflength ) {
		//var samplesToGenerate = this.bufsize - (this.buffer.length / this.channels);
		var samplesToGenerate = this.bufsize;
		//console.log("AudioMixer fillBuffer: generating ", samplesToGenerate, ", samples, buffer length: ", this.buffer.length, "active sources: ", active_sources.length);
		for(var i = 0; i < samplesToGenerate; i++) {
			var left = 0;
			var right = 0;
			for(var s in active_sources) {
				if(this.sources[s].state != AudioSource.state.disabled ||  this.sources[s].state != AudioSource.state.zombie) {
					var sam = this.sources[s].takeSample();
					left += sam[0];
					right += sam[1];
				}
			}	
			// apply gain to combined waveform
			left *= this.gain_factor_l;
			right *= this.gain_factor_r;
			// clip as we push
			this.buffer.push(Math.min(1.0, Math.max(-1.0, left)));
			this.buffer.push(Math.min(1.0, Math.max(-1.0, right)));
		}
	} 
};

AudioMixer.prototype.takeSamples = function(samples) {

	samples = samples <= this.bufsize ? samples : this.bufsize;
	//console.log("AudioMixer takeSamples: asked for: ", samples, ", samples, buffer length: ", this.buffer.length);

	if(this.buffer.length < samples * this.channels ) {
		this.fillBuffer();
	}
	if(this.buffer.length < samples * this.channels ) {
		samples = this.buffer.length / this.channels;
	}
	if(this.buffer.length >= this.channels ) {
		//console.log("AudioMixer: giving ", samples, ", samples, buffer length: ", this.buffer.length);
		this.state = AudioMixer.state.running;
		var ret = this.buffer.slice(0, samples * 2);
		this.buffer = this.buffer.slice(samples * 2);
		return ret;
	} else {
		this.state = AudioMixer.state.idle;
		// we're idle. how best to handle this? FIXME
		// return a lowly sample for now
		console.log("AudioMixer takeSamples: bailing due to inability to fill buffer");
		return([0.0, 0.0]);
	}
};

function AudioManager(opts) {
	//if (!opts) opts = {};
	this.channels = 2;					// for now, all we support (possibly forever)
	this.sampleBufferSize = 16384;
	this.sampleBufferLength = 32768;
	this.minBufferLength = this.sampleBufferLength / 2;			// low samples mark
	// hard-coded in Flash player, webKit usually overrides this to 48000
	this.setSampleRate(44100);

	// FIXME: this goes I think
	this.requestStop = false;
	this.detectMode();
}

AudioManager.INSTANCE = null;

AudioManager.get = function() {
	if(AudioManager.INSTANCE == null) {
		AudioManager.INSTANCE = new AudioManager();
	} 
	return AudioManager.Instance
}

AudioManager.mode = Object.freeze({ firefox:{}, webkit:{}, flash:{} });

AudioManager.prototype.setSampleRate = function(samplerate) {
	this.sampleRate = samplerate;
	this.minDuration = Math.ceil(this.minBufferLength / this.sampleRate * 1000);		// low duration mark
	this.checkInterval = this.minDuration / 4; 						// in ms
	this.mixer = new AudioMixer({
		bufsize: this.sampleBufferSize,
		mixrate: this.sampleRate
	})
};

AudioManager.prototype.detectMode = function() {
	var audioElement = new Audio();
	if (audioElement.mozSetup) {
		this.mode = AudioManager.mode.firefox;
		this.audioElement = audioElement;
		audioElement.mozSetup(this.channels, this.sampleRate);
		// other vars related to this backend
		this.buffer = []; /* data generated but not yet written */
		return this.mode;
	}
	var webkitAudio = window.AudioContext || window.webkitAudioContext;
	if (webkitAudio) {
		this.mode = AudioManager.mode.webkit;
		this.webkitAudioContext = new webkitAudio();
		this.setSampleRate(this.webkitAudioContext.sampleRate);
		return this.mode;
	}
	// Fall back to creating flash player
	this.mode = AudioManager.mode.flash;
	this.flashInserted = false;
	return this.mode;

}

AudioManager.prototype.setGenerator = function(generator) {
	return this.mixer.addSource(generator);
}

AudioManager.prototype.stop = function() {
	switch (this.mode) {
		case AudioManager.mode.webkit:
			this.node.disconnect();
			break;
		case AudioManager.mode.flash:
			this.swf.stop();
			break;
	}
	this.requestStop = true;
}

AudioManager.prototype.start = function() {
	console.log("starting audio");
	switch (this.mode) {
		case AudioManager.mode.firefox:
			this.firefoxCheckBuffer();
			break;
		case AudioManager.mode.webkit:
			this.node = this.webkitAudioContext.createJavaScriptNode(this.sampleBufferSize, 0, this.channels);
			var that = this;
			this.node.onaudioprocess = function(e) { that.webkitProcess(e) };
			// start
			this.node.connect(this.webkitAudioContext.destination);
			break;
		case AudioManager.mode.flash:
			this.flashInsert();
			this.flashCheckReady();
			break;
	}
}

AudioManager.prototype.firefoxCheckBuffer = function() {
	if (this.buffer.length) {
		var written = this.audioElement.mozWriteAudio(this.buffer);
		this.buffer = this.buffer.slice(written);
	}
	if (this.buffer.length < this.minBufferLength && !this.mixer.finished) {
		this.buffer = this.buffer.concat(this.mixer.takeSamples(this.sampleBufferSize));
	}
	if (!this.requestStop && (!this.mixer.finished || this.buffer.length)) {
		var that = this;
		setTimeout(function() { that.firefoxCheckBuffer() }, this.checkInterval);
	}
}

AudioManager.prototype.webkitProcess = function(e) {
	// FIXME. This shouldn't be controlled by the mixer I think.
	if (this.mixer.finished) {
		this.node.disconnect();
		return;
	}
			
	var dataLeft = e.outputBuffer.getChannelData(0);
	var dataRight = e.outputBuffer.getChannelData(1);

	var generate = this.mixer.takeSamples(this.sampleBufferSize);
	//console.log("webkit process: generated", generate.length, "samples");

	for (var i = 0; i < (generate.length / 2); ++i) {
		dataLeft[i] = generate[i*2];
		dataRight[i] = generate[i*2+1];
	}
	
}

AudioManager.prototype.flashInsert = function() {
	if(!this.flashInserted) {
		this.flashInserted = true;
		var c = document.createElement('div');
		c.innerHTML = '<embed type="application/x-shockwave-flash" id="da-swf" src="da.swf" width="8" height="8" allowScriptAccess="always" style="position: fixed; left:-10px;" />';
		//var bodynode = document.getElementsByTagName('body')[0];
		document.body.appendChild(c);
		this.swf = document.getElementById('da-swf');
	}
}

AudioManager.prototype.flashWrite = function(data) {
	var out = new Array(data.length);
	for (var i = data.length-1; i != 0; i--) {
		out[i] = Math.floor(data[i]*32768);
	}
	return this.swf.write(out.join(' '));
}

AudioManager.prototype.flashCheckBuffer = function() {
	if (this.swf.bufferedDuration() < this.minDuration) {
		this.flashWrite(this.mixer.takeSamples(this.sampleBufferSize));
	}
	if (!this.requestStop && !this.mixer.finished) {
		var that = this;
		setTimeout( function() { that.flashCheckBuffer(); }, this.checkInterval);
	}
}

AudioManager.prototype.flashCheckReady = function() {
	if (this.swf.write) {
		this.flashCheckBuffer();
	} else {
		var that = this;
		setTimeout(function() { that.flashCheckReady(); }, 10);
	}
}

AudioManager.prototype.flashBufferedDuration = function() {
	return this.swf.bufferedDuration();
}

