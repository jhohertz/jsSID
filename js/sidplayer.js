
function SidFile(data) {
	this.loaded = false;
	if(data) {
		this.loadFileFromData(data);
	}
};

SidFile.prototype.loadFileFromData = function(data) {
        var stream = Stream(data);
        stream.seek(0x07);
        this.data_offset = stream.readInt8();            // 0x07
        this.not_load_addr   = stream.readInt16();               // 0x08
        this.init_addr   = stream.readInt16();           // 0x0a
        this.play_addr   = stream.readInt16();           // 0x0c
        stream.seek(0x0f);
        this.subsongs    = stream.readInt8() - 1;                // 0x0f
        stream.seek(0x11);
        this.startsong   = stream.readInt8() - 1;                // 0x11
        stream.seek(0x15);
        this.speed       = stream.readInt8();            // 0x15
        stream.seek(0x16);
        this.name = stream.read(32);
        stream.seek(0x36);
        this.author = stream.read(32);
        stream.seek(0x56);
        this.copyright = stream.read(32);

        stream.seek(this.data_offset);
        this.load_addr       = stream.readInt8();
        this.load_addr      |= stream.readInt8() << 8;
        var loadptr = this.load_addr;

        // create new memory array and zero
        this.mem = new Array(65536);
        for(var i=0; i<65536; i++) {
                this.mem[i]=0;
        }

        while (!stream.eof()) {
                this.mem[loadptr] = stream.readInt8();
                loadptr++;
        }

};

// constructor
function SidPlayer(synth) {
	this.synth = synth;

	this.ready = false;
	
	this.play_active = true;
	this.finished = false;
	this.samplesToNextFrame = 0;
};


// load the .sid file into a 64k memory image array
SidPlayer.prototype.loadFileFromData = function(data) {
	this.sidfile = new SidFile(data);

	this.sidspeed = this.sidfile.speed ? 100 : 50;		// 0=50hz, 1=100hz
	this.samplesPerFrame = this.synth.mix_freq / this.sidspeed 
	this.cpu = new Sid6510(this.sidfile.mem, this.synth);

	// now everything is setup, initialize the sid if needed
	if (this.sidfile.play_addr == 0) {
		this.cpu.cpuJSR(this.sidfile.init_addr, 0);
		this.sidfile.play_addr = (this.cpu.mem[0x0315] << 8) + this.cpu.mem[0x0314];
		console.log("new play_addr: ", this.sidfile.play_addr);
	}

	this.cpu.cpuJSR(this.sidfile.init_addr, this.sidfile.startsong);

	this.finished = false;
	this.samplesToNextFrame = 0;

	// get the first frame
	this.getNextFrame();

	this.ready = true;
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
		this.finished = true;
	}
};
	
SidPlayer.prototype.generate = function(samples) {
	var data = new Array(samples*2);
	this.generateIntoBuffer(samples, data, 0);
	return data;
};
	
// generator
SidPlayer.prototype.generateIntoBuffer = function(samples, data, dataOffset) {
	if(!this.ready) return [0.0,0.0];
	dataOffset = dataOffset || 0;

	//console.log("Generating " + samples + " samples (" + samplesToNextFrame + " to next frame)");
	var samplesRemaining = samples;
		
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
	//return data;
}

	
//function replay(audio) {
//	console.log('replay');
//	audio.write(generate(44100));
//	setTimeout(function() {replay(audio)}, 10);
//}
	

