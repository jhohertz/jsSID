function SidPlayer(sidFile, synth, cpu) {

	var sidspeed = sidFile.speed ? 100 : 50;		// 0=50hz, 1=100hz
	var samplesPerFrame = synth.mix_freq / sidspeed 
	
	var samplesToNextFrame = 0;
	var play_active = true;
	//var frame_done = true;
	
	// now everything is setup, initialize the sid if needed
	if (sidFile.play_addr == 0) {
		cpu.cpuJSR(sidFile.init_addr, 0);
		sidFile.play_addr = (cpu.mem[0x0315] << 8) + cpu.mem[0x0314];
	}

	cpu.cpuJSR(sidFile.init_addr, sidFile.startsong);

	// loads the next frame of dump data, setting the sid registers
	// also handle end condition

	function getNextFrame() {

		if (play_active) {
			cpu.cpuJSR(sidFile.play_addr,0);
			samplesToNextFrame += samplesPerFrame;
			//frame_done = false;
		} else {
			// FIXME: currently, this is not reachable really
			
			// no frames left
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
				var samplesToGenerate = Math.ceil(samplesToNextFrame);
				//console.log("next frame: " + samplesToNextFrame + ", remaining: " + samplesRemaining + ", offset: " + dataOffset + ", generate: " + samplesToGenerate);
				if (samplesToGenerate > 0) {
					var generated = synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
					dataOffset += generated * 2;
					samplesRemaining -= generated;
					samplesToNextFrame -= generated;
				}
				
				getNextFrame();
			} else {
				/* generate samples to end of buffer */
				if (samplesRemaining > 0) {
					var generated = synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
					samplesToNextFrame -= generated;
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

