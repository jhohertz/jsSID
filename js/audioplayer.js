

function AudioSource(myid, generator) {
	this.id = myid;
	this.channels = 2;
	this.bufsize = 16384;
	this.buffer = new Array();
	this.generator = generator;
	this.fill_cursor = 0;
	this.setGain(0);
};

AudioSource.prototype.setGain = function(gain) {
	this.gain_factor = Math.pow(10.0, (gain - 3.0) / 20.0);
}

AudioSource.prototype.fillBuffer = function() {
}

AudioSource.prototype.takeSamples = function(samples) {
}

function AudioMixer() {
	if (!opts) opts = {};
	this.next_src_id = 0;
	this.sources = {};
	this.setGain(0);
	this.bufsize = 16384;
	this.buffer = new Array();
	this.fill_cursor = 0;
};

AudioMixer.prototype.setGain = function(gain) {
	this.gain_factor = Math.pow(10.0, (gain + 3.0) / 20.0);
}

AudioMixer.prototype.addSource = function(generator, volume) {
	var newid = next_src_id++;
	this.sources[newid] = new AudioSource(newid, generator, volume)		
	return newid;
};




function AudioManager(opts) {
	if (!opts) opts = {};
	this.generator = opts.generator || null;

	this.channels = 2;					// for now, all we support (possibly forever)

	this.sampleBufferLength = 8192;					// samples per latency duration
	this.minBufferLength = this.sampleBufferLength / 2;			// low samples mark

	// hard-coded in Flash player, webKit usually overrides this to 48000
	this.setSampleRate(44100);
	this.requestStop = false;
	this.detectMode();
}

AudioManager.mode = Object.freeze({ firefox:{}, webkit:{}, flash:{} });

AudioManager.prototype.setSampleRate = function(samplerate) {
	this.sampleRate = samplerate;
	this.minDuration = Math.ceil(this.minBufferLength / this.sampleRate * 1000);		// low duration mark
	this.checkInterval = this.minDuration / 2; 						// in ms
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
	this.generator = generator;
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
			this.node = this.webkitAudioContext.createJavaScriptNode(this.sampleBufferLength, 0, this.channels);
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
	if (this.buffer.length < this.minBufferLength && !this.generator.finished) {
		this.buffer = this.buffer.concat(this.generator.generate(this.sampleBufferLength));
	}
	if (!this.requestStop && (!this.generator.finished || this.buffer.length)) {
		var that = this;
		setTimeout(function() { that.firefoxCheckBuffer() }, this.checkInterval);
	}
}

AudioManager.prototype.webkitProcess = function(e) {
	if (this.generator.finished) {
		this.node.disconnect();
		return;
	}
			
	//console.log("webkit process");
	var dataLeft = e.outputBuffer.getChannelData(0);
	var dataRight = e.outputBuffer.getChannelData(1);

	var generate = this.generator.generate(this.sampleBufferLength);

	for (var i = 0; i < this.sampleBufferLength; ++i) {
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
		this.flashWrite(this.generator.generate(this.sampleBufferLength));
	}
	if (!this.requestStop && !this.generator.finished) {
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

