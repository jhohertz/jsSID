
function SidDmpPlayer(sidDmpFile, synth) {
	this.siddmp = sidDmpFile;
	this.synth = synth;
        this.samplesPerFrame = synth.mix_freq / 50;

	this.nextFrameNum = 0;
	this.samplesToNextFrame = 0;
	

	// get the first frame
	this.getNextFrame();
};

// loads the next frame of dump data, setting the sid registers
// also handle end condition
SidDmpPlayer.prototype.getNextFrame = function() {
	var nextFrame = null;

	if (this.nextFrameNum < this.siddmp.length) {
		// have a frame to give
		var nextFrame = this.siddmp[this.nextFrameNum];
		this.nextFrameNum++;
			
		// poke frame registers
		var stream = Stream(nextFrame);
		var count = 0;
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
		var count = 0;
		while ( count < 25) {
			this.synth.poke(count, 0);
			count++;
		}

		this.finished = true;
	}
}
	
	
// generator
SidDmpPlayer.prototype.generate = function (samples) {
	//console.log("Generating " + samples + " samples (" + samplesToNextFrame + " to next frame)");
	var data = new Array(samples*2);
	var samplesRemaining = samples;
	var dataOffset = 0;
		
	while (true) {
		if (this.samplesToNextFrame != null && this.samplesToNextFrame <= samplesRemaining) {
			/* generate samplesToNextFrame samples, process frame and repeat */
			var samplesToGenerate = Math.ceil(this.samplesToNextFrame);
			//console.log("next frame: " + samplesToNextFrame + ", remaining: " + samplesRemaining + ", offset: " + dataOffset + ", generate: " + samplesToGenerate);
			if (samplesToGenerate > 0) {
				var generated = this.synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
				dataOffset += generated * 2;
				samplesRemaining -= generated;
				this.samplesToNextFrame -= generated;
			}
				
			this.getNextFrame();
		} else {
			/* generate samples to end of buffer */
			if (samplesRemaining > 0) {
				var generated = this.synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
				this.samplesToNextFrame -= generated;
			}
			break;
		}
	}
	//console.log("data: ", data);
	return data;
}

// maybe flash uses this?
//function replay(audio) {
//	console.log('replay');
//	audio.write(generate(44100));
//	setTimeout(function() {replay(audio)}, 10);
//}
	
