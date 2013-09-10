
// constructor
function SidPlayer(sidFile, synth) {
	this.sidfile = sidFile;
	this.synth = synth;
	this.cpu = new Sid6510(this.sidfile.mem, this.synth);
	this.sidspeed = this.sidfile.speed ? 100 : 50;		// 0=50hz, 1=100hz
	this.samplesPerFrame = synth.mix_freq / this.sidspeed 
	
	this.samplesToNextFrame = 0;
	this.play_active = true;
	this.finished = false;
	
	// now everything is setup, initialize the sid if needed
	if (this.sidfile.play_addr == 0) {
		this.cpu.cpuJSR(this.sidfile.init_addr, 0);
		this.sidfile.play_addr = (this.cpu.mem[0x0315] << 8) + this.cpu.mem[0x0314];
		console.log("new play_addr: ", this.sidfile.play_addr);
	}
	this.cpu.cpuJSR(this.sidfile.init_addr, this.sidfile.startsong);

	// get the first frame
	this.getNextFrame();
};

SidPlayer.prototype.getNextFrame = function() {
	if (this.play_active) {
		this.cpu.cpuJSR(this.sidfile.play_addr, 0);
		this.samplesToNextFrame += this.samplesPerFrame;
	} else {
		// FIXME: currently, this is not reachable really
			
		// no frames left
		this.samplesToNextFrame = null;

		// FIXME: this should be a feature of SidSynth we call
		// zero out sid registers at end to prevent noise
		var count = 0;
		while ( count < 25) {
			this.synth.poke(count, 0);
			count++;
		}
		self.finished = true;
	}
}
	
	
// generator
SidPlayer.prototype.generate = function(samples) {
	//console.log("Generating " + samples + " samples (" + samplesToNextFrame + " to next frame)");
	var data = new Array(samples*2);
	var samplesRemaining = samples;
	var dataOffset = 0;
		
	while (true) {
		if (this.samplesToNextFrame != null && this.samplesToNextFrame <= samplesRemaining) {
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

	
//function replay(audio) {
//	console.log('replay');
//	audio.write(generate(44100));
//	setTimeout(function() {replay(audio)}, 10);
//}
	

