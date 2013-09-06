
function AudioPlayer(opts) {
	if (!opts) opts = {};
	this.generator = opts.generator || null;
	this.latency = opts.latency || 1;
	this.checkInterval = this.latency * 100 			/* in ms */
	this.sampleRate = 44100; 				/* hard-coded in Flash player*/
	this.requestStop = false;
	this.detectMode();
}

AudioPlayer.mode = Object.freeze({ firefox:{}, webkit:{}, flash:{} });

AudioPlayer.prototype.detectMode = function() {
	var audioElement = new Audio();
	if (audioElement.mozSetup) {
		this.mode = AudioPlayer.mode.firefox;
		this.audioElement = audioElement;
		audioElement.mozSetup(2, this.sampleRate); 	/* channels, sample rate */
		// other vars related to this backend
		this.buffer = []; /* data generated but not yet written */
		this.minBufferLength = this.latency * 2 * this.sampleRate; /* refill buffer when there are only this many elements remaining */
		this.bufferFillLength = Math.floor(this.latency * this.sampleRate);
		return this.mode;
	}
	var webkitAudio = window.AudioContext || window.webkitAudioContext;
	if (webkitAudio) {
		this.mode = AudioPlayer.mode.webkit;
		this.webkitAudioContext = new webkitAudio();
		this.sampleRate = this.webkitAudioContext.sampleRate;
		// other vars related to this backend
		this.channelCount = 2;
		this.bufferSize = 4096*4; // Higher for less gitches, lower for less latency
		return this.mode;
	}

	// Fall back to creating flash player
	// other vars related to this backend
	this.minBufferDuration = this.latency * 1000; /* refill buffer when there are only this many ms remaining */
	this.bufferFillLength = this.latency * this.sampleRate;
	this.mode = AudioPlayer.mode.flash;
	this.flashInserted = false;
	return this.mode;

}

AudioPlayer.prototype.setGenerator = function(generator) {
	this.generator = generator;
}

AudioPlayer.prototype.stop = function() {
	switch (this.mode) {
		case AudioPlayer.mode.webkit:
			this.node.disconnect();
			break;
		case AudioPlayer.mode.flash:
			this.swf.stop();
			break;
	}
	this.requestStop = true;
}

AudioPlayer.prototype.start = function() {
	switch (this.mode) {
		case AudioPlayer.mode.firefox:
			this.firefoxCheckBuffer();
			break;
		case AudioPlayer.mode.webkit:
			this.node = this.webkitAudioContext.createJavaScriptNode(this.bufferSize, 0, this.channelCount);
			var that = this;
			this.node.onaudioprocess = function(e) { that.webkitProcess(e) };
			// start
			this.node.connect(this.webkitAudioContext.destination);
			break;
		case AudioPlayer.mode.flash:
			this.flashInsert();
			this.flashCheckReady();
			break;
	}
}

AudioPlayer.prototype.firefoxCheckBuffer = function() {
	if (this.buffer.length) {
		var written = this.audioElement.mozWriteAudio(this.buffer);
		this.buffer = this.buffer.slice(written);
	}
	if (this.buffer.length < this.minBufferLength && !this.generator.finished) {
		this.buffer = this.buffer.concat(this.generator.generate(this.bufferFillLength));
	}
	if (!this.requestStop && (!this.generator.finished || this.buffer.length)) {
		var that = this;
		setTimeout(function() { that.firefoxCheckBuffer() }, this.checkInterval);
	}
}

AudioPlayer.prototype.webkitProcess = function(e) {
	if (this.generator.finished) {
		this.node.disconnect();
		return;
	}
			
	var dataLeft = e.outputBuffer.getChannelData(0);
	var dataRight = e.outputBuffer.getChannelData(1);

	var generate = this.generator.generate(this.bufferSize);

	for (var i = 0; i < this.bufferSize; ++i) {
		dataLeft[i] = generate[i*2];
		dataRight[i] = generate[i*2+1];
	}
	
}

AudioPlayer.prototype.flashInsert = function() {
	if(!this.flashInserted) {
		this.flashInserted = true;
		var c = document.createElement('div');
		c.innerHTML = '<embed type="application/x-shockwave-flash" id="da-swf" src="da.swf" width="8" height="8" allowScriptAccess="always" style="position: fixed; left:-10px;" />';
		//var bodynode = document.getElementsByTagName('body')[0];
		document.body.appendChild(c);
		this.swf = document.getElementById('da-swf');
	}
}

AudioPlayer.prototype.flashWrite = function(data) {
	var out = new Array(data.length);
	for (var i = data.length-1; i != 0; i--) {
		out[i] = Math.floor(data[i]*32768);
	}
	return this.swf.write(out.join(' '));
}

AudioPlayer.prototype.flashCheckBuffer = function() {
	if (this.swf.bufferedDuration() < this.minBufferDuration) {
		this.flashWrite(this.generator.generate(this.bufferFillLength));
	}
	if (!this.requestStop && !this.generator.finished) {
		var that = this;
		setTimeout( function() { that.flashCheckBuffer(); }, this.checkInterval);
	}
}

AudioPlayer.prototype.flashCheckReady = function() {
	if (this.swf.write) {
		this.flashCheckBuffer();
	} else {
		var that = this;
		setTimeout(function() { that.flashCheckReady(); }, 10);
	}
}

AudioPlayer.prototype.flashBufferedDuration = function() {
	return this.swf.bufferedDuration();
}

