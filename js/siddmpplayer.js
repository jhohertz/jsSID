
function SidDmpPlayer(opts) {
	console.log("player opts", opts);
        opts = opts || {};
        this.quality = opts.quality || SIDFactory.quality.good;
        this.clock = opts.clock || jsSID.chip.clock.PAL;
	// state signaled to audiomanager
	this.finished = false;
	this.ready = false;

	var that = this;
	this.sink = Sink(function(b, c){that.sinkCall(b,c);});

	this.factory = new SIDFactory();
	this.synth = this.factory.create({
		quality: this.quality,
		clock: this.clock,
		mixrate: this.sink.sampleRate
	});

	this.siddmp = null;
        this.samplesPerFrame = this.synth.mix_freq / 50;
	this.nextFrameNum = 0;
	this.samplesToNextFrame = 0;

}

// to use sink vs audiomanager
SidDmpPlayer.prototype.sinkCall = function(buffer, channels) {
	if(this.ready) {
		var written = this.generateIntoBuffer(buffer.length, buffer, 0);
		if (written === 0) {
				//play_mod(random_mod_href());
				this.ready = false;
				this.finished = true;
				return 0;
		} else {
				return written;
		}
	}

};

SidDmpPlayer.prototype.play = function() {
	this.ready = true;
};

SidDmpPlayer.prototype.stop = function() {
	this.ready = false;
};

// load the .dmp sid dump file format
// 60 frames per second of 25 bytes, representing the sid register states
SidDmpPlayer.prototype.loadFileFromData = function(data) {
	this.stop();
	var stream = Stream(data);

	this.siddmp = [];
	while (!stream.eof()) {
		var frame = stream.read(25);
		this.siddmp.push(frame);
	}

	// reset state
	this.nextFrameNum = 0;
	this.samplesToNextFrame = 0;
	// get the first frame
	this.getNextFrame();
};

// loads the next frame of dump data, setting the sid registers
// also handle end condition
SidDmpPlayer.prototype.getNextFrame = function() {
	var nextFrame = null;
	var count;

	if (this.nextFrameNum < this.siddmp.length) {
		// have a frame to give
		nextFrame = this.siddmp[this.nextFrameNum];
		this.nextFrameNum++;
			
		// poke frame registers
		var stream = Stream(nextFrame);
		count = 0;
		while ((!stream.eof()) && count < 25) {
			var val = stream.readInt8();
			this.synth.poke(count, val);
			count++;
		}
		this.samplesToNextFrame += this.samplesPerFrame;
	} else {
		// no frames left
		this.nextFrameNum = null;
		this.samplesToNextFrame = null;

		// FIXME: this should be a feature of SidSynth we call
		// zero out sid registers at end to prevent noise
		count = 0;
		while ( count < 25) {
			this.synth.poke(count, 0);
			count++;
		}

		this.finished = true;
		this.ready = false;
	}
};
	
SidDmpPlayer.prototype.generate = function (samples) {
        var data = new Array(samples*2);
        this.generateIntoBuffer(samples, data, 0);
        return data;
};
	
// generator
SidDmpPlayer.prototype.generateIntoBuffer = function (samples, data, dataOffset) {
	if(!this.ready) return [0.0,0.0];

	dataOffset = dataOffset || 0;
	var dataOffsetStart = dataOffset;

	//console.log("Generating " + samples + " samples");
	var samplesRemaining = samples / 2;
	var generated;
	while (true) {
		if (this.samplesToNextFrame !== null && this.samplesToNextFrame <= samplesRemaining) {
			/* generate samplesToNextFrame samples, process frame and repeat */
			var samplesToGenerate = Math.ceil(this.samplesToNextFrame);
			//console.log("next frame: " + this.samplesToNextFrame + ", remaining: " + samplesRemaining + ", offset: " + dataOffset + ", generate: " + samplesToGenerate);
			if (samplesToGenerate > 0) {
				generated = this.synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
				dataOffset += generated * 2;
				samplesRemaining -= generated;
				this.samplesToNextFrame -= generated;
			}
				
			this.getNextFrame();
		} else {
			/* generate samples to end of buffer */
			if (samplesRemaining > 0) {
				generated = this.synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
				this.samplesToNextFrame -= generated;
			}
			break;
		}
	}
	return dataOffset - dataOffsetStart;
};

// maybe flash uses this?
//function replay(audio) {
//	console.log('replay');
//	audio.write(generate(44100));
//	setTimeout(function() {replay(audio)}, 10);
//}
	
