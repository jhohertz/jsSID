function SidDmpPlayer(sidDmpFile, synth) {

	//var samplesPerFrame = 882;		// 50hz	dmp files only supported
        var samplesPerFrame = synth.mix_freq / 50


	//for (var i = 0; i < sidDmpFile.length; i++) {
	//}
	
	var nextFrameNum = 0;
	var samplesToNextFrame = 0;
	
	// loads the next frame of dump data, setting the sid registers
	// also handle end condition

	function getNextFrame() {
		var nextFrame = null;

		if (nextFrameNum < sidDmpFile.length) {
			// have a frame to give
			var nextFrame = sidDmpFile[nextFrameNum];
			nextFrameNum++;
			
			// poke frame registers
			var stream = Stream(nextFrame);
			var count = 0;
			while ((!stream.eof()) && count < 25) {
				var val = stream.readInt8();
				synth.poke(count, val);
				count++;
			}
			samplesToNextFrame = samplesPerFrame;

		} else {
			// no frames left
			nextFrameNum = null;
			samplesToNextFrame = null;

			// FIXME: this should be a feature of SidSynth we call
			// zero out sid registers at end to prevent noise
			var count = 0;
			while ( count < 25) {
				synth.poke(count, 0);
				count++;
			}

			self.finished = true;
		}
	}
	
	// get the first frame
	getNextFrame();
	
	// generator
	function generate(samples) {
		//console.log("Generating " + samples + " samples (" + samplesToNextFrame + " to next frame)");
		var data = new Array(samples*2);
		var samplesRemaining = samples;
		var dataOffset = 0;
		
		while (true) {
			if (samplesToNextFrame != null && samplesToNextFrame <= samplesRemaining) {
				/* generate samplesToNextFrame samples, process frame and repeat */
				var samplesToGenerate = Math.ceil(samplesToNextFrame);
				//console.log("next frame: " + samplesToNextFrame + ", remaining: " + samplesRemaining + ", offset: " + dataOffset + ", generate: " + samplesToGenerate);
				if (samplesToGenerate > 0) {
					synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
					dataOffset += samplesToGenerate * 2;
					samplesRemaining -= samplesToGenerate;
					samplesToNextFrame -= samplesToGenerate;
				}
				
				getNextFrame();
			} else {
				/* generate samples to end of buffer */
				if (samplesRemaining > 0) {
					synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
					samplesToNextFrame -= samplesRemaining;
				}
				break;
			}
		}
		//console.log("data: ", data);
		return data;
	}

	
	function replay(audio) {
		console.log('replay');
		audio.write(generate(44100));
		setTimeout(function() {replay(audio)}, 10);
	}
	
	var self = {
		'replay': replay,
		'generate': generate,
		'finished': false
	}
	return self;
}

