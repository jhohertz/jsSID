
jsSID.DMPPlayer = function(opts) {
	console.log("player opts", opts);
        opts = opts || {};
        this.quality = opts.quality || jsSID.quality.good;
        this.clock = opts.clock || jsSID.chip.clock.PAL;
        this.model = opts.model || jsSID.chip.model.MOS6581;
	// state signaled to audiomanager
	this.finished = false;
	this.ready = false;

	var that = this;

	this.synth = jsSID.synthFactory({
		quality: this.quality,
		clock: this.clock,
		model: this.model,
		sampleRate: pico.samplerate
	});

	this.siddmp = null;
        this.samplesPerFrame = this.synth.mix_freq / 50;
	this.nextFrameNum = 0;
	this.samplesToNextFrame = 0;

};

// Pico.js hook for processing
jsSID.DMPPlayer.prototype.process = function(L, R) {
        if(this.ready) {
                var written = this.generateIntoBuffer(L.length, L, 0);
                if (written === 0) {
                        //play_mod(random_mod_href());
                        this.ready = false;
                        this.finished = true;
                        this.stop();
                } else {
                        // copy left channel to right
                        for (var i = 0; i < L.length; i++) {
                                R[i] = L[i];
                        }
                }
        } else {
                this.stop();
        }
};

jsSID.DMPPlayer.prototype.play = function() {
        this.ready = true;
        pico.play(this);
};

jsSID.DMPPlayer.prototype.stop = function() {
        pico.pause();
        this.ready = false;
};

// load the .dmp sid dump file format
// 60 frames per second of 25 bytes, representing the sid register states
jsSID.DMPPlayer.prototype.loadFileFromData = function(data) {
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
jsSID.DMPPlayer.prototype.getNextFrame = function() {
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
	
jsSID.DMPPlayer.prototype.generate = function (samples) {
        var data = new Array(samples);
        this.generateIntoBuffer(samples, data, 0);
        return data;
};
	
// generator
jsSID.DMPPlayer.prototype.generateIntoBuffer = function (samples, data, dataOffset) {
	if(!this.ready) return 0;

	dataOffset = dataOffset || 0;
	var dataOffsetStart = dataOffset;

	//console.log("Generating " + samples + " samples");
	var samplesRemaining = samples;
	var generated;
	while (true) {
		if (this.samplesToNextFrame !== null && this.samplesToNextFrame <= samplesRemaining) {
			/* generate samplesToNextFrame samples, process frame and repeat */
			var samplesToGenerate = Math.ceil(this.samplesToNextFrame);
			//console.log("next frame: " + this.samplesToNextFrame + ", remaining: " + samplesRemaining + ", offset: " + dataOffset + ", generate: " + samplesToGenerate);
			if (samplesToGenerate > 0) {
				generated = this.synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
				dataOffset += generated;
				samplesRemaining -= generated;
				this.samplesToNextFrame -= generated;
			}
				
			this.getNextFrame();
		} else {
			/* generate samples to end of buffer */
			if (samplesRemaining > 0) {
				generated = this.synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
				dataOffset += generated;
				samplesRemaining -= generated;
				this.samplesToNextFrame -= generated;
			}
			break;
		}
	}
	return dataOffset - dataOffsetStart;
};

