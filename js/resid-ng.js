

DAC = {};
DAC.build_dac_table = function(dac, bits, _2R_div_R, term) {
	var vbit = new Array(bits);
	for (var set_bit = 0; set_bit < bits; set_bit++) {
		var bit;

		var Vn = 1.0;
		var R = 1.0;
		var _2R = _2R_div_R * R;
		var Rn = term ? _2R : Infinity; 

		for (bit = 0; bit < set_bit; bit++) {
			if (Rn == Infinity) {
				Rn = R + _2R;
			} else {
				Rn = R + _2R * Rn / (_2R + Rn);
			}
		}

		if (Rn == Infinity) {
			Rn = _2R;
		} else {
			Rn = _2R * Rn / (_2R + Rn);
			Vn = Vn * Rn / _2R;
		}

		for (++bit; bit < bits; bit++) {
			Rn += R;
			var I = Vn / Rn;
			Rn = _2R * Rn / (_2R + Rn);
			Vn = Rn * I;
		}

		vbit[set_bit] = Vn;
	}
	for (var i = 0; i < (1 << bits); i++) {
		var x = i;
		var Vo = 0;
		for (var j = 0; j < bits; j++) {
			Vo += (x & 0x1) * vbit[j];
			x >>= 1;
		}
		dac[i] = Math.floor(((1 << bits) - 1) * Vo + 0.5) & 0xFFFF;
	}
};

// EnvelopeGenerator
EnvelopeGenerator = function(model) {
	this.set_chip_model(model);
	this.reset();
};

EnvelopeGenerator.State = Object.freeze({
	ATTACK: {}, DECAY_SUSTAIN: {}, RELEASE: {}
});

EnvelopeGenerator.rate_counter_period = Array(
	9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19532, 31251
);

// this one seems like overkill... idx +  (idx<<4) should do it...
EnvelopeGenerator.sustain_level = Array(
	0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff
);

EnvelopeGenerator.model_dac = function() {
	var ret = new Array(new Array(1<<8), new Array(1<<8));
	DAC.build_dac_table(ret[0], 8, 2.20, false);
	DAC.build_dac_table(ret[1], 8, 2.00, true);
	return ret;
}();

EnvelopeGenerator.prototype.set_chip_model = function(model) {
	this.sid_model = model;
};

EnvelopeGenerator.prototype.reset = function() {
	this.envelope_counter = 0;
	this.envelope_pipeline = 0;
	this.attack = 0;
	this.decay = 0;
	this.sustain = 0;
	this.release = 0;
	this.gate = 0;
	this.rate_counter = 0;
	this.exponential_counter = 0;
	this.exponential_counter_period = 1;
	this.state = EnvelopeGenerator.State.RELEASE;
	this.rate_period = EnvelopeGenerator.rate_counter_period[this.release];
	this.hold_zero = true;
};

EnvelopeGenerator.prototype.writeCONTROL_REG = function(control) {
	var gate_next = control & 0x01;
	if (!this.gate && gate_next) {
		this.state = EnvelopeGenerator.State.ATTACK;
		this.rate_period = EnvelopeGenerator.rate_counter_period[this.attack];
		this.hold_zero = false;
		this.envelope_pipeline = 0;
	} else if (this.gate && !gate_next) {
		this.state = EnvelopeGenerator.State.RELEASE;
		this.rate_period = EnvelopeGenerator.rate_counter_period[this.release];
	}
	this.gate = gate_next;
};

EnvelopeGenerator.prototype.writeATTACK_DECAY = function(attack_decay) {
	this.attack = (attack_decay >> 4) & 0x0f;
	this.decay = attack_decay & 0x0f;
	if (this.state == EnvelopeGenerator.State.ATTACK) {
		this.rate_period = EnvelopeGenerator.rate_counter_period[this.attack];
	} else if (this.state == EnvelopeGenerator.State.DECAY_SUSTAIN) {
		this.rate_period = EnvelopeGenerator.rate_counter_period[this.decay];
	}
};

EnvelopeGenerator.prototype.writeSUSTAIN_RELEASE = function(sustain_release) {
	this.sustain = (sustain_release >> 4) & 0x0f;
	this.release = sustain_release & 0x0f;
	if (this.state == EnvelopeGenerator.State.RELEASE) {
		this.rate_period = EnvelopeGenerator.rate_counter_period[this.release];
	}
};

EnvelopeGenerator.prototype.readENV = function() {
	return this.envelope_counter;
};

EnvelopeGenerator.prototype.output = function() {
	return EnvelopeGenerator.model_dac[this.sid_model][this.envelope_counter];
};

// definitions of EnvelopeGenerator methods below here are called for every sample
EnvelopeGenerator.prototype.clock_one = function() {

	if (this.envelope_pipeline) {
		--this.envelope_counter;
		this.envelope_counter &= 0xff;
		this.envelope_pipeline = 0;
		this.set_exponential_counter();
	}

	if (++this.rate_counter & 0x8000) {
		++this.rate_counter;
		this.rate_counter &= 0x7fff;
	}
	if (this.rate_counter != this.rate_period) {
		return;
	}
	this.rate_counter = 0;
	if (this.state == EnvelopeGenerator.State.ATTACK || ++this.exponential_counter == this.exponential_counter_period) {
		this.exponential_counter = 0;
		if (this.hold_zero) {
			return;
		}
		switch (this.state) {
			case EnvelopeGenerator.State.ATTACK:
				++this.envelope_counter;
				this.envelope_counter &= 0xff;
				if (this.envelope_counter == 0xff) {
					this.state = EnvelopeGenerator.State.DECAY_SUSTAIN;
					this.rate_period = EnvelopeGenerator.rate_counter_period[this.decay];
				}
				break;
			case EnvelopeGenerator.State.DECAY_SUSTAIN:
				if (this.envelope_counter == EnvelopeGenerator.sustain_level[this.sustain]) {
					return;
				}
				if (this.exponential_counter_period != 1) {
					this.envelope_pipeline = 1;
					return;
				}
				--this.envelope_counter;
				this.envelope_counter &= 0xff;
				break;
			case EnvelopeGenerator.State.RELEASE:
				if (this.exponential_counter_period != 1) {
					this.envelope_pipeline = 1;
					return;
				}
				--this.envelope_counter;
				this.envelope_counter &= 0xff;
				break;
		}
		this.set_exponential_counter();
	}
};

EnvelopeGenerator.prototype.clock_delta = function(delta_t) {
	var rate_step = this.rate_period - this.rate_counter;
	if (rate_step <= 0) {
		rate_step += 0x7fff;
	}
	while (delta_t) {
		if (delta_t < rate_step) {
			this.rate_counter += delta_t;
			if (this.rate_counter & 0x8000) {
				++this.rate_counter;
				this.rate_counter &= 0x7fff;
			}
			return;
		}

		delta_t -= rate_step;

		this.rate_counter = 0;
		if (this.state == EnvelopeGenerator.State.ATTACK || ++this.exponential_counter == this.exponential_counter_period) {
			this.exponential_counter = 0;
			if (this.hold_zero) {
				return;
			}
			switch (this.state) {
				case EnvelopeGenerator.State.ATTACK:
					++this.envelope_counter;
					this.envelope_counter &= 0xff;
					if (this.envelope_counter == 0xff) {
						this.state = EnvelopeGenerator.State.DECAY_SUSTAIN;
						this.rate_period = EnvelopeGenerator.rate_counter_period[this.decay];
					}
					break;
				case EnvelopeGenerator.State.DECAY_SUSTAIN:
					if (this.envelope_counter == EnvelopeGenerator.sustain_level[this.sustain]) {
						return;
					}
					--this.envelope_counter;
					this.envelope_counter &= 0xff;
					break;
				case EnvelopeGenerator.State.RELEASE:
					--this.envelope_counter;
					this.envelope_counter &= 0xff;
					break;
			}
			this.set_exponential_counter();
		}

		rate_step = this.rate_period;
	}

};

EnvelopeGenerator.prototype.set_exponential_counter = function() {
	switch (this.envelope_counter) {
		case 0xff:
			this.exponential_counter_period = 1;
			break;
		case 0x5d:
			this.exponential_counter_period = 2;
			break;
		case 0x36:
			this.exponential_counter_period = 4;
			break;
		case 0x1a:
			this.exponential_counter_period = 8;
			break;
		case 0x0e:
			this.exponential_counter_period = 16;
			break;
		case 0x06:
			this.exponential_counter_period = 30;
			break;
		case 0x00:
			this.exponential_counter_period = 1;
			this.hold_zero = true;
			break;
	}
};

// Waveform object
function WaveformGenerator() {
	this.sync_source = this;
	this.sid_model = jsSID.chip.model.MOS6581;
	this.reset();
}

WaveformGenerator.prototype.set_chip_model = function(model) {
	this.sid_model = model;
	this.wave = WaveformGenerator.model_wave[model][this.waveform & 0x7];
};

WaveformGenerator.prototype.reset = function() {
	this.accumulator = 0;
	this.freq = 0;
	this.pw = 0;
	this.msb_rising = false;
	this.waveform = 0;
	this.test = 0;
	this.ring_mod = 0;
	this.sync = 0;
	this.wave = WaveformGenerator.model_wave[this.sid_model][0];
	this.ring_msb_mask = 0;
	this.no_noise = 0xfff;
	this.no_pulse = 0xfff;
	this.pulse_output = 0xfff;
	this.reset_shift_register();
	this.shift_pipeline = 0;
	this.waveform_output = 0;
	this.floating_output_ttl = 0;
};

WaveformGenerator.prototype.set_sync_source = function(source) {
	this.sync_source = source;
	source.sync_dest = this;
};

WaveformGenerator.prototype.writeFREQ_LO = function(freq_lo) {
	this.freq = (this.freq & 0xff00) | (freq_lo & 0x00ff);
};

WaveformGenerator.prototype.writeFREQ_HI = function(freq_hi) {
	this.freq = ((freq_hi << 8) & 0xff00) | (this.freq & 0x00ff);
};

WaveformGenerator.prototype.writePW_LO = function(pw_lo) {
	this.pw = (this.pw & 0xf00) | (pw_lo & 0x0ff);
	this.pulse_output = (this.accumulator >> 12) >= this.pw ? 0xfff : 0x000;
};

WaveformGenerator.prototype.writePW_HI = function(pw_hi) {
	this.pw = ((pw_hi << 8) & 0xf00) | (this.pw & 0x0ff);
	this.pulse_output = (this.accumulator >> 12) >= this.pw ? 0xfff : 0x000;
};

WaveformGenerator.prototype.writeCONTROL_REG = function(control) {
	var waveform_prev = this.waveform;
	var test_prev = this.test;
	this.waveform = (control >> 4) & 0x0f;
	this.test = control & 0x08;
	this.ring_mod = control & 0x04;
	this.sync = control & 0x02;
	this.wave = WaveformGenerator.model_wave[this.sid_model][this.waveform & 0x7];
	this.ring_msb_mask = ((~control >> 5) & (control >> 2) & 0x1) << 23;
	this.no_noise = this.waveform & 0x8 ? 0x000 : 0xfff;
	this.no_noise_or_noise_output = this.no_noise | this.noise_output;
	this.no_pulse = this.waveform & 0x4 ? 0x000 : 0xfff;

	if (!test_prev && this.test) {
		this.accumulator = 0;
		this.shift_pipeline = 0;
		this.shift_register_reset = 0x8000;
		this.pulse_output = 0xfff;
	} else if (test_prev && !this.test) {
		var bit0 = (~this.shift_register >> 17) & 0x1;
		this.shift_register = ((this.shift_register << 1) | bit0) & 0x7fffff;
		this.set_noise_output();
	}

	if (this.waveform) {
		this.set_waveform_output_one();
	} else if (waveform_prev) {
		this.floating_output_ttl = 0x14000;
	}

};

WaveformGenerator.prototype.readOSC = function() {
	return this.waveform_output >> 4;
};

WaveformGenerator.prototype.clock_one = function() {
	if (this.test) {
		if (this.shift_register_reset && (!--this.shift_register_reset)) {
			this.reset_shift_register();
		}
		this.pulse_output = 0xfff;
	} else {
		var accumulator_next = (this.accumulator + this.freq) & 0xffffff;
		var accumulator_bits_set = ~this.accumulator & accumulator_next;
		this.accumulator = accumulator_next;
		this.msb_rising = (accumulator_bits_set & 0x800000) ? true : false;
		if (accumulator_bits_set & 0x080000) {
			this.shift_pipeline = 2;
		} else if (this.shift_pipeline && (!--this.shift_pipeline)) {
			this.clock_shift_register();
		}
	}

};

WaveformGenerator.prototype.clock_delta = function(delta_t) {
	if (this.test) {
		if (this.shift_register_reset) {
			this.shift_register_reset -= delta_t;
			if (this.shift_register_reset <= 0) {
				this.reset_shift_register();
			}
		}
		this.pulse_output = 0xfff;
	} else {
		var delta_accumulator = delta_t * this.freq;
		var accumulator_next = (this.accumulator + delta_accumulator) & 0xffffff;
		var accumulator_bits_set = ~this.accumulator & accumulator_next;
		this.accumulator = accumulator_next;
		this.msb_rising = (accumulator_bits_set & 0x800000) ? true : false;
		var shift_period = 0x100000;
		while (delta_accumulator) {
			if (delta_accumulator < shift_period) {
				shift_period = delta_accumulator;
				if (shift_period <= 0x080000) {
					if (((this.accumulator - shift_period) & 0x080000) || !(this.accumulator & 0x080000)) {
						break;
					}
				} else {
					if (((this.accumulator - shift_period) & 0x080000) && !(this.accumulator & 0x080000)) {
						break;
					}
				}
			}
			this.clock_shift_register();
			delta_accumulator -= shift_period;
		}
		this.pulse_output = (this.accumulator >> 12) >= this.pw ? 0xfff : 0x000;
	}

};

WaveformGenerator.prototype.synchronize = function() {
	if (this.msb_rising && this.sync_dest.sync && !(this.sync && this.sync_source.msb_rising)) {
		this.sync_dest.accumulator = 0;
	}
};

WaveformGenerator.prototype.clock_shift_register = function() {
	var bit0 = ((this.shift_register >> 22) ^ (this.shift_register >> 17)) & 0x1;
	this.shift_register = ((this.shift_register << 1) | bit0) & 0x7fffff;
	this.set_noise_output();
};

WaveformGenerator.prototype.write_shift_register = function() {
	// FIXME: bit flip mask warning
	// FIXME: first line of this is basically static?
	this.shift_register &=
		~((1<<20)|(1<<18)|(1<<14)|(1<<11)|(1<<9)|(1<<5)|(1<<2)|(1<<0)) |
		((this.waveform_output & 0x800) << 9) |
		((this.waveform_output & 0x400) << 8) |
		((this.waveform_output & 0x200) << 5) |
		((this.waveform_output & 0x100) << 3) |
		((this.waveform_output & 0x080) << 2) |
		((this.waveform_output & 0x040) >> 1) |
		((this.waveform_output & 0x020) >> 3) |
		((this.waveform_output & 0x010) >> 4);
	this.noise_output &= this.waveform_output;
	this.no_noise_or_noise_output = this.no_noise | this.noise_output;
};

WaveformGenerator.prototype.reset_shift_register = function() {
	this.shift_register = 0x7fffff;
	this.shift_register_reset = 0;
	this.set_noise_output();
};

WaveformGenerator.prototype.set_noise_output = function() {
	noise_output =
		((this.shift_register & 0x100000) >> 9) |
		((this.shift_register & 0x040000) >> 8) |
		((this.shift_register & 0x004000) >> 5) |
		((this.shift_register & 0x000800) >> 3) |
		((this.shift_register & 0x000200) >> 2) |
		((this.shift_register & 0x000020) << 1) |
		((this.shift_register & 0x000004) << 3) |
		((this.shift_register & 0x000001) << 4);
	this.no_noise_or_noise_output = this.no_noise | this.noise_output;
};

WaveformGenerator.prototype.set_waveform_output_one = function() {
	if (this.waveform) {
		var ix = (this.accumulator ^ (this.sync_source.accumulator & this.ring_msb_mask)) >> 12;
		this.waveform_output = this.wave[ix] & (this.no_pulse | this.pulse_output) & this.no_noise_or_noise_output;
		if (this.waveform > 0x8) {
			this.write_shift_register();
		}
	} else {
		if (this.floating_output_ttl && (!--this.floating_output_ttl)) {
			this.waveform_output = 0;
		}
	}
	this.pulse_output = -((this.accumulator >> 12) >= this.pw) & 0xfff;
};

WaveformGenerator.prototype.set_waveform_output_delta = function(delta_t) {
	if (this.waveform) {
		var ix = (this.accumulator ^ (this.sync_source.accumulator & this.ring_msb_mask)) >> 12;
		this.waveform_output = this.wave[ix] & (this.no_pulse | this.pulse_output) & this.no_noise_or_noise_output;
		if (this.waveform > 0x8) {
			this.write_shift_register();
		}
	} else {
		if (this.floating_output_ttl) {
			this.floating_output_ttl -= delta_t;
			if (this.floating_output_ttl <= 0) {
				this.floating_output_ttl = 0;
				this.waveform_output = 0;
			}
		}
	}
};

WaveformGenerator.prototype.output = function() {
	return WaveformGenerator.model_dac[this.sid_model][this.waveform_output];
};

WaveformGenerator.comboTableCompressed = 
	"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" +
	"iID/ATiBVooAgAAA";

// expand/generate tables
WaveformGenerator.model_wave = function() {
	var data = JXG.decompress(WaveformGenerator.comboTableCompressed);
	var stream = Stream(data);
	var combo = new Array(32768);
	var i, j;
	for(i = 0; i < 32768; i++) {
		combo[i] = stream.readInt8();
	}
	var ret = new Array(2);
	for(i = 0; i < 2; i++) {
		ret[i] = new Array(8);
		for(j = 0; j < 8; j++) {
			ret[i][j] = new Array(1 << 12);
		}
	}
	// FIXME: do we need to use the member var here really?
	var accumulator = 0;
	for (i = 0; i < (1 << 12); i++) {
		var msb = (accumulator & 0x800000) ? 1 : 0;
		ret[0][0][i] = ret[1][0][i] = 0xfff;
		// FIXME: possible size error on this?
		ret[0][1][i] = ret[1][1][i] = ((accumulator ^ -msb) >> 11) & 0xffe;
		ret[0][2][i] = ret[1][2][i] = accumulator >> 12;
		ret[0][3][i] = combo[i];
		ret[1][3][i] = combo[i + 16384];
		ret[0][4][i] = ret[1][4][i] = 0xfff;
		ret[0][5][i] = combo[i + 4096];
		ret[1][5][i] = combo[i + 4096 + 16384];
		ret[0][6][i] = combo[i + 8192];
		ret[1][6][i] = combo[i + 8192 + 16384];
		ret[0][7][i] = combo[i + 12288];
		ret[1][7][i] = combo[i + 12288 + 16384];
		accumulator += 0x1000;
	}
	return ret;
}();

WaveformGenerator.model_dac = function() {
	var ret = new Array(new Array(1 << 12), new Array(1 << 12));
	DAC.build_dac_table(ret[0], 12, 2.20, false);
	DAC.build_dac_table(ret[1], 12, 2.00, true);
	return ret;
}();


// Voice class
Voice = function() {
	this.envelope = new EnvelopeGenerator();
	this.wave = new WaveformGenerator();
	this.set_chip_model(jsSID.chip.model.MOS6581);
};

Voice.prototype.set_chip_model = function(model) {
	this.wave.set_chip_model(model);
	this.envelope.set_chip_model(model);
	if (model == jsSID.chip.model.MOS6581) {
		this.wave_zero = 0x380;
	} else {
		this.wave_zero = 0x800;
	}
};

Voice.prototype.set_sync_source = function(source) {
	this.wave.set_sync_source(source.wave);
};

Voice.prototype.writeCONTROL_REG = function(control) {
	this.wave.writeCONTROL_REG(control);
	this.envelope.writeCONTROL_REG(control);
};

Voice.prototype.reset = function() {
	this.wave.reset();
	this.envelope.reset();
};

// definitions of Voice methods below here are called for every sample
Voice.prototype.output = function() {
	return (this.wave.output() - this.wave_zero) * this.envelope.output();
};


// ExternalFilter class
ExternalFilter = function() {
	this.reset();
	this.enable_filter(true);
	// A lot of work to get 13 for both.... 
	this.w0lp_1_s7 = Math.floor(100000 * 1.0e-6 * (1 << 7) + 0.5);
	this.w0hp_1_s17 = Math.floor(100 * 1.0e-6 * (1 << 17) + 0.5);

};

ExternalFilter.prototype.enable_filter = function(enable) {
	this.enabled = enable;
};

ExternalFilter.prototype.reset = function() {
	this.Vlp = 0;
	this.Vhp = 0;
};

ExternalFilter.prototype.clock_one = function(Vi) {
	if (!this.enabled) {
		this.Vlp = Vi << 11;
		this.Vhp = 0;
		return;
	}
	var dVlp = this.w0lp_1_s7 * ((Vi << 11) - this.Vlp) >> 7;
	var dVhp = this.w0hp_1_s17 * (this.Vlp - this.Vhp) >> 17;
	this.Vlp += dVlp;
	this.Vhp += dVhp;
};

ExternalFilter.prototype.clock_delta = function(Vi, delta_t) {
	if (!this.enabled) {
		this.Vlp = Vi << 11;
		this.Vhp = 0;
		return;
	}
	var delta_t_flt = 8;
	while (delta_t) {
		if (delta_t < delta_t_flt) {
			delta_t_flt = delta_t;
		}
		var dVlp = (this.w0lp_1_s7 * delta_t_flt >> 3) * ((Vi << 11) - this.Vlp) >> 4;
		var dVhp = (this.w0hp_1_s17 * delta_t_flt >> 3) * (this.Vlp - this.Vhp) >> 14;
		this.Vlp += dVlp;
		this.Vhp += dVhp;
		delta_t -= delta_t_flt;
	}
};

ExternalFilter.prototype.output = function() {
	var half = 1 << 15;
	var Vo = (this.Vlp - this.Vhp) >> 11;
	if (Vo >= half) {
		Vo = half - 1;
	} else if (Vo < -half) {
		Vo = -half;
	}
	return Vo;
};


// constructor, no.. just a collection of functions for now
PointPlotter = {};

PointPlotter.interpolate = function(inP, plot, res) {
	var k1, k2;
	var p0 = 0;
	var p1 = 1;
	var p2 = 2;
	var p3 = 3;
	var pn = inP.length - 1;

	for (; p2 != pn; ++p0, ++p1, ++p2, ++p3) {
		if (inP[p1][0] == inP[p2][0]) {
			continue;
		}
		if (inP[p0][0] == inP[p1][0] && inP[p2][0] == inP[p3][0]) {
			k1 = (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]);
			k2 = k1;
		} else if (inP[p0][0] == inP[p1][0]) {
			k2 = (inP[p3][1] - inP[p1][1]) / (inP[p3][0] - inP[p1][0]);
			k1 = (3 * (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]) - k2) / 2;
		} else if (inP[p2][0] == inP[p3][0]) {
			k1 = (inP[p2][1] - inP[p0][1]) / (inP[p2][0] - inP[p0][0]);
			k2 = (3 * (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]) - k1) / 2;
		} else {
			k1 = (inP[p2][1] - inP[p0][1]) / (inP[p2][0] - inP[p0][0]);
			k2 = (inP[p3][1] - inP[p1][1]) / (inP[p3][0] - inP[p1][0]);
		}
		PointPlotter.interpolate_segment(inP[p1][0], inP[p1][1], inP[p2][0], inP[p2][1], k1, k2, plot, res);
	}


};

PointPlotter.cubic_coefficients = function(x1, y1, x2, y2, k1, k2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var a = ((k1 + k2) - 2 * dy / dx) / (dx * dx);
	var b = ((k2 - k1) / dx - 3 * (x1 + x2) * a) / 2;
	var c = k1 - (3 * x1 * a + 2 * b) * x1;
	var d = y1 - ((x1 * a + b) * x1 + c) * x1;
	return new Object({ a: a, b: b, c: c, d: d });
};

PointPlotter.interpolate_brute_force = function(x1, y1, x2, y2, k1, k2, plot, res) {
	var cc = PointPlotter.cubic_coefficients(x1, y1, x2, y2, k1, k2);
	for (var x = x1; x <= x2; x += res) {
		var y = ((cc.a * x + cc.b) * x + cc.c) * x + cc.d;
		//plot[x] = (y < 0) ? 0 : y;
		plot[Math.floor(x)] = ((y < 0) ? 0 : y) + 0.5;
	}
};


PointPlotter.interpolate_forward_difference = function(x1, y1, x2, y2, k1, k2, plot, res) {
	var cc = PointPlotter.cubic_coefficients(x1, y1, x2, y2, k1, k2);
	var y = ((cc.a * x1 + cc.b) * x1 + cc.c) * x1 + cc.d;
	var dy = (3 * cc.a * (x1 + res) + 2 * cc.b) * x1 * res + ((cc.a * res + cc.b) * res + cc.c) * res;
	var d2y = (6 * cc.a * (x1 + res) + 2 * cc.b) * res * res;
	var d3y = 6 * cc.a * res * res * res;
	for (var x = x1; x <= x2; x += res) {
		//plot[x] = (y < 0) ? 0 : y;
		plot[Math.floor(x)] = ((y < 0) ? 0 : y) + 0.5;
		y += dy;
		dy += d2y;
		d2y += d3y;
	}
};

PointPlotter.spline_brute_force = false;

PointPlotter.interpolate_segment = 
	PointPlotter.spline_brute_force ?
	PointPlotter.interpolate_brute_force :
	PointPlotter.interpolate_forward_difference;

///////////////// NEW FILTER



Filter = function() {
	this.enable_filter(true);
	this.set_chip_model(jsSID.chip.model.MOS6581);
	this.set_voice_mask(0x07);
	this.input(0);
	this.reset();
};


Filter.model_init = new Array(2);
// FIXME: need to cleanup namespace, constants for ReSID chimp model not defined yet
Filter.model_init[0] = {		// 6581
	opamp_voltage: [
		[  0.81, 10.31 ], [  0.81, 10.31 ], [  2.40, 10.31 ], [  2.60, 10.30 ],
		[  2.70, 10.29 ], [  2.80, 10.26 ], [  2.90, 10.17 ], [  3.00, 10.04 ],
		[  3.10,  9.83 ], [  3.20,  9.58 ], [  3.30,  9.32 ], [  3.50,  8.69 ],
		[  3.70,  8.00 ], [  4.00,  6.89 ], [  4.40,  5.21 ], [  4.54,  4.54 ],
		[  4.60,  4.19 ], [  4.80,  3.00 ], [  4.90,  2.30 ], [  4.95,  2.03 ],
		[  5.00,  1.88 ], [  5.05,  1.77 ], [  5.10,  1.69 ], [  5.20,  1.58 ],
		[  5.40,  1.44 ], [  5.60,  1.33 ], [  5.80,  1.26 ], [  6.00,  1.21 ],
		[  6.40,  1.12 ], [  7.00,  1.02 ], [  7.50,  0.97 ], [  8.50,  0.89 ],
		[ 10.00,  0.81 ], [ 10.31,  0.81 ], [ 10.31,  0.81 ]
	],
	voice_voltage_range: 1.5,
	voice_DC_voltage: 5.0,
	C: 470e-12,
	Vdd: 12.18,
	Vth: 1.31,
	Ut: 26.0e-3,
	k: 1.0,
	uCox: 20e-6,
	WL_vcr: 9.0/1,
	WL_snake: 1.0/115,
	dac_zero: 6.65,
	dac_scale: 2.63,
	dac_2R_div_R: 2.20,
	dac_term: false
};
Filter.model_init[1] = {		// 8580
	opamp_voltage: [
		[  1.30,  8.91 ], [  1.30,  8.91 ], [  4.76,  8.91 ], [  4.77,  8.90 ],
		[  4.78,  8.88 ], [  4.785, 8.86 ], [  4.79,  8.80 ], [  4.795, 8.60 ],
		[  4.80,  8.25 ], [  4.805, 7.50 ], [  4.81,  6.10 ], [  4.815, 4.05 ],
		[  4.82,  2.27 ], [  4.825, 1.65 ], [  4.83,  1.55 ], [  4.84,  1.47 ],
		[  4.85,  1.43 ], [  4.87,  1.37 ], [  4.90,  1.34 ], [  5.00,  1.30 ],
		[  5.10,  1.30 ], [  8.91,  1.30 ], [  8.91,  1.30 ] 
	],
	voice_voltage_range: 1.0,
	voice_DC_voltage: 1.3,
	C: 22e-9,
	Vdd: 9.09,
	Vth: 0.8,
	Ut: 26.0e-3,
	k: 1.0,
	uCox: 10e-6,
	//WL_vcr: 0,	 // 6581 only, do not set for 8580 (init relies on this)
	WL_snake: 0,
	dac_zero: 0,
	dac_scale: 0,
	dac_2R_div_R: 2.00,
	dac_term: true
};


Filter.summer_offset = function() {
	var entries = 6;
	var ret = new Array(entries);
	ret[0] = 0;
	for(var i = 1; i < entries; i++) {
		ret[i] = ret[i - 1] + ((2 + i - 1) << 16);
	}
	return ret;
}();
Filter.mixer_offset = function() {
	var entries = 9;
	var ret = new Array(entries);
	ret[0] = 0;
	ret[1] = 1;
	for(var i = 2; i < entries; i++) {
		ret[i] = ret[i - 1] + ((i - 1) << 16);
	}
	return ret;
}();


// just a really complex constructor used to initialize tables of the model
// FIXME: should be proper subclass of filter, defined within filter due to cross dependancies
FilterModel = function(fi) {
	var vmin = fi.opamp_voltage[0][0];
	var opamp_max = fi.opamp_voltage[0][1];
	var kVddt = fi.k * (fi.Vdd - fi.Vth);
	var vmax = kVddt < opamp_max ? opamp_max : kVddt;
	var denorm = vmax - vmin;
	var norm = 1.0 / denorm;
	var N16 = norm * 0x0000FFFF;
	var N30 = norm * 0x3FFFFFFF;
	var N31 = norm * 0x7FFFFFFF;

	this.vo_N16 = Math.floor(N16);  // FIXME: Remove?
	var N14 = norm * (1 << 14);

	this.voice_scale_s14 = Math.floor(N14 * fi.voice_voltage_range);
	this.voice_DC = Math.floor(N16 * (fi.voice_DC_voltage - vmin));
	this.kVddt = Math.floor(N16 * (kVddt - vmin) + 0.5);
	this.n_snake = Math.floor(denorm * (1 << 13) * (fi.uCox / (2 * fi.k) * fi.WL_snake * 1.0e-6 / fi.C) + 0.5);

	var scaled_voltage = new Array(fi.opamp_voltage.length);
	for (var i = 0; i < fi.opamp_voltage.length; i++) {
		// FIXME: this could be flattened into one statement
		scaled_voltage[fi.opamp_voltage.length - 1 - i] = new Array(2);
		scaled_voltage[fi.opamp_voltage.length - 1 - i][0] = Math.floor((N16 * (fi.opamp_voltage[i][1] - fi.opamp_voltage[i][0]) + (1 << 16)) / 2 + 0.5);
		scaled_voltage[fi.opamp_voltage.length - 1 - i][1] = N31 * (fi.opamp_voltage[i][0] - vmin);
	}

	if (scaled_voltage[fi.opamp_voltage.length - 1][0] >= (1 << 16)) {
		scaled_voltage[fi.opamp_voltage.length - 1][0] =
		scaled_voltage[fi.opamp_voltage.length - 2][0] = (1 << 16) - 1;
	}

	var opamp = new Array(1<<16);
	PointPlotter.interpolate(scaled_voltage, opamp, 1.0);

	this.ak = Math.floor(scaled_voltage[0][0]);
	this.bk = Math.floor(scaled_voltage[fi.opamp_voltage.length - 1][0]);
	var j;
	for (j = 0; j < this.ak; j++) {
		opamp[j] = 0;
	}
	var f = opamp[j] - (opamp[j + 1] - opamp[j]);
	for (; j <= this.bk; j++) {
		var fp = f;
		f = opamp[j];
		var df = f - fp;
		// FIXME: bit inversion may bring more bits than expected?
		opamp[j] = ((df << 12) & ~0xffff) | (f >> 15);
	}
	for (; j < (1 << 16); j++) {
		opamp[j] = 0;
	}
	this.gain = new Array(16);
	var x, vi, sg, n;
	for (var n8 = 0; n8 < 16; n8++) {
		this.gain[n8] = new Array(1<<16);
		n = n8 << 4;
		x = this.ak;
		for (vi = 0; vi < (1 << 16); vi++) {
			sg = this.solve_gain(opamp, n, vi, x);
			this.gain[n8][vi] = sg[0];
			x = sg[1];
		}
	}
	var offset = 0;
	var size;
	this.summer = new Array(Filter.summer_offset[5]);
	var idiv, n_idiv;
	for (var k = 0; k < 5; k++) {
		idiv = 2 + k;
		n_idiv = idiv << 7;
		size = idiv << 16;
		x = this.ak;
		for (vi = 0; vi < size; vi++) {
			sg = this.solve_gain(opamp, n_idiv, vi / idiv, x);
			this.summer[offset + vi] = sg[0];
			x = sg[1];
		}
		offset += size;
	}
	offset = 0;
	size = 1;
	this.mixer = new Array(Filter.mixer_offset[8]);
	for (var l = 0; l < 8; l++) {
		idiv = l;
		n_idiv = (idiv << 7) * 8 / 6;
		if (idiv === 0) {
			idiv = 1;
		}
		x = this.ak;
		for (vi = 0; vi < size; vi++) {
			sg = this.solve_gain(opamp, n_idiv, vi / idiv, x);
			this.mixer[offset + vi] = sg[0];
			x = sg[1];
		}
		offset += size;
		size = (l + 1) << 16;
	}

	this.opamp_rev = new Array(1<<16);
	for (var m = 0; m < (1 << 16); m++) {
		this.opamp_rev[m] = opamp[m] & 0xffff;
	}

	this.vc_max = Math.floor(N30 * (fi.opamp_voltage[0][1] - fi.opamp_voltage[0][0]));
	this.vc_min = Math.floor(N30 * (fi.opamp_voltage[fi.opamp_voltage.length - 1][1] - 
		fi.opamp_voltage[fi.opamp_voltage.length - 1][0]));
	var bits = 11;
	this.f0_dac = new Array(1<<bits);
	DAC.build_dac_table(this.f0_dac, bits, fi.dac_2R_div_R, fi.dac_term);
	for (n = 0; n < (1 << bits); n++) {
		this.f0_dac[n] = Math.floor(N16 * (fi.dac_zero + this.f0_dac[n] * fi.dac_scale / (1 << bits) - vmin) + 0.5) & 0xffff;
	}

	// only set for 6581
	if("WL_vcr" in fi) {

		N16 = this.vo_N16;
		vmin = N16 * fi.opamp_voltage[0][0];
		kVddt = N16 * (fi.k * (fi.Vdd - fi.Vth));

		this.vcr_kVg = new Array(1<<16);
		for (var p = 0; p < (1 << 16); p++) {
			var Vg = kVddt - Math.sqrt(p * (1 << 16));
			this.vcr_kVg[p] = Math.floor(fi.k * Vg - vmin + 0.5) & 0xffff;
		}

		var kVt = fi.k * fi.Vth;
		var Ut = fi.Ut;
		var Is = 2 * fi.uCox * Ut * Ut / fi.k * fi.WL_vcr;
		var N15 = N16 / 2;
		var n_Is = N15 * 1.0e-6 / fi.C * Is;

		this.vcr_n_Ids_term = new Array(1<<16);
		for (var kVg_Vx = 0; kVg_Vx < (1 << 16); kVg_Vx++) {
			var log_term = Math.log(1 + Math.exp((kVg_Vx / N16 - kVt) / (2 * Ut)));
			this.vcr_n_Ids_term[kVg_Vx] = Math.floor(n_Is * log_term * log_term) & 0xffff;
		}
	}
};

// FIXME: passing x through like this is crufty.. switch to passing a referenced object
FilterModel.prototype.solve_gain = function(opamp, n, vi, x) {
	n = Math.floor(n);
	vi = Math.floor(vi);
	x = Math.floor(x);

	var ak = this.ak, bk = this.bk;
	var a = n + (1 << 7);
	var b = Math.floor(this.kVddt);
	var b_vi = b - vi;

	if (b_vi < 0) b_vi = 0;

	var c = n * Math.floor((b_vi >>> 0) * b_vi >>> 12);

	for (;;) {
		var xk = x;
		var vx_dvx = opamp[x];
		var vx = vx_dvx & 0xffff;
		var dvx = vx_dvx >> 16;
		var vo = vx + (x << 1) - (1 << 16);

		if (vo >= (1 << 16)) {
			vo = (1 << 16) - 1;
		} else if (vo < 0) {
			vo = 0;
		}
	
		var b_vx = b - vx;
		if (b_vx < 0) b_vx = 0;
		var b_vo = b - vo;
		if (b_vo < 0) b_vo = 0;

		var f = a * Math.floor((b_vx >>> 0) * b_vx >>> 12) - c - Math.floor((b_vo >>> 0) * b_vo >>> 5);
		var df = (b_vo * (dvx + (1 << 11)) - a * (b_vx * dvx >> 7)) >> 15;

		x -= Math.floor(f / df);
		if (x == xk) {
			return [vo, x];
		}

		if (f < 0) {
			ak = xk;
		} else {
			bk = xk;
		}

		if (x <= ak || x >= bk) {
			x = (ak + bk) >> 1;
			if (x == ak) {
				return [vo, x];
			}
		}
	}


};

// FIXME: this is kind of heavy... maybe a way to defer until the profile is asked for?
Filter.model = new Array(
	new FilterModel(Filter.model_init[0]),
	new FilterModel(Filter.model_init[1])
);

Filter.prototype.enable_filter = function(enable) {
	this.enabled = enable;
	this.set_sum_mix();
};

Filter.prototype.adjust_filter_bias = function(dac_bias) {
	this.Vw_bias = Math.floor(dac_bias * Filter.model[sid_model].vo_N16);
	this.set_w0();
};

Filter.prototype.set_chip_model = function(model) {
	this.sid_model = model;
	this.Vhp = 0;
	this.Vbp = 0;
	this.Vbp_x = 0;
	this.Vbp_vc = 0;
	this.Vlp = 0;
	this.Vlp_x = 0;
	this.Vlp_vc = 0;
};

Filter.prototype.set_voice_mask = function(mask) {
	this.voice_mask = 0xf0 | (mask & 0x0f);
	this.set_sum_mix();
};

Filter.prototype.reset = function() {
	this.fc = 0;
	this.res = 0;
	this.filt = 0;
	this.mode = 0;
	this.vol = 0;
	this.Vhp = 0;
	this.Vbp = 0;
	this.Vbp_x = 0;
	this.Vbp_vc = 0;
	this.Vlp = 0;
	this.Vlp_x = 0;
	this.Vlp_vc = 0;

	this.set_w0();
	this.set_Q();
	this.set_sum_mix();
};

Filter.prototype.writeFC_LO = function(fc_lo) {
	this.fc = (this.fc & 0x7f8) | (fc_lo & 0x007);
	this.set_w0();
};

Filter.prototype.writeFC_HI = function(fc_hi) {
	this.fc = ((fc_hi << 3) & 0x7f8) | (this.fc & 0x007);
	this.set_w0();
};

Filter.prototype.writeRES_FILT = function(res_filt) {
	this.res = (res_filt >> 4) & 0x0f;
	this.set_Q();
	this.filt = res_filt & 0x0f;
	this.set_sum_mix();
};

Filter.prototype.writeMODE_VOL = function(mode_vol) {
	this.mode = mode_vol & 0xf0;
	this.vol = mode_vol & 0x0f;
};

Filter.prototype.set_w0 = function() {
	var f = Filter.model[this.sid_model];
	var Vw = this.Vw_bias + f.f0_dac[this.fc];
	// FIXME: unaccounted unsign cast
	//	this.Vddt_Vw_2 = unsigned(f.kVddt - Vw)*unsigned(f.kVddt - Vw) >> 1;
	this.Vddt_Vw_2 = ((f.kVddt - Vw) >>> 0) * (f.kVddt - Vw) >>> 1;
	this.w0 = 82355 * (this.fc + 1) >> 11;
};

Filter._1024_div_Q_table = new Array(
	1448, 1328, 1218, 1117, 1024, 939, 861, 790, 724, 664, 609, 558, 512, 470, 431, 395
);

Filter.prototype.set_Q = function() {
	// FIXME: should be safe of this inversion
	this._8_div_Q = ~this.res & 0x0f;
	this._1024_div_Q = Filter._1024_div_Q_table[this.res];
};

Filter.prototype.set_sum_mix = function() {
	this.sum = (this.enabled ? this.filt : 0x00) & this.voice_mask;
	// FIXME: possible bit inversion in nead of masking (looks ok though)
	this.mix = (this.enabled ? (this.mode & 0x70) | ((~(this.filt | (this.mode & 0x80) >> 5)) & 0x0f) : 0x0f) & this.voice_mask;
};


Filter.prototype.clock_one = function(voice1, voice2, voice3) {
	var f = Filter.model[this.sid_model];

	this.v1 = (voice1 * f.voice_scale_s14 >> 18) + f.voice_DC;
	this.v2 = (voice2 * f.voice_scale_s14 >> 18) + f.voice_DC;
	this.v3 = (voice3 * f.voice_scale_s14 >> 18) + f.voice_DC;

	// FIXME: no check for enabled as in delta, should we?

	var Vi = 0;
	var offset = 0;

	switch (this.sum & 0xf) {
		case 0x0:
			Vi = 0;
			offset = Filter.summer_offset[0];
			break;
		case 0x1:
			Vi = this.v1;
			offset = Filter.summer_offset[1];
			break;
		case 0x2:
			Vi = this.v2;
			offset = Filter.summer_offset[1];
			break;
		case 0x3:
			Vi = this.v1 + this.v2;
			offset = Filter.summer_offset[2];
			break;
		case 0x4:
			Vi = this.v3;
			offset = Filter.summer_offset[1];
			break;
		case 0x5:
			Vi = this.v1 + this.v3;
			offset = Filter.summer_offset[2];
			break;
		case 0x6:
			Vi = this.v2 + this.v3;
			offset = Filter.summer_offset[2];
			break;
		case 0x7:
			Vi = this.v1 + this.v2 + this.v3;
			offset = Filter.summer_offset[3];
			break;
		case 0x8:
			Vi = this.ve;
			offset = Filter.summer_offset[1];
			break;
		case 0x9:
			Vi = this.ve + this.v1;
			offset = Filter.summer_offset[2];
			break;
		case 0xa:
			Vi = this.ve + this.v2;
			offset = Filter.summer_offset[2];
			break;
		case 0xb:
			Vi = this.ve + this.v2 + this.v1;
			offset = Filter.summer_offset[3];
			break;
		case 0xc:
			Vi = this.ve + this.v3;
			offset = Filter.summer_offset[2];
			break;
		case 0xd:
			Vi = this.ve + this.v3 + this.v1;
			offset = Filter.summer_offset[3];
			break;
		case 0xe:
			Vi = this.ve + this.v3 + this.v2;
			offset = Filter.summer_offset[3];
			break;
		case 0xf:
			Vi = this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.summer_offset[4];
			break;
	}

	if (this.sid_model === 0) {
		this.solve_integrate_6581_Vlp(1, f);
		this.solve_integrate_6581_Vbp(1, f);
		this.Vhp = f.summer[offset + f.gain[this._8_div_Q][this.Vbp] + this.Vlp + Vi];
	} else {
		var dVbp = this.w0 * (this.Vhp >> 4) >> 16;
		var dVlp = this.w0 * (this.Vbp >> 4) >> 16;
		this.Vbp -= dVbp;
		this.Vlp -= dVlp;
		this.Vhp = (this.Vbp * this._1024_div_Q >> 10) - this.Vlp - Vi;
	}

};

Filter.prototype.clock_delta = function(voice1, voice2, voice3, delta_t) {
	var f = Filter.model[this.sid_model];

	this.v1 = (voice1 * f.voice_scale_s14 >> 18) + f.voice_DC;
	this.v2 = (voice2 * f.voice_scale_s14 >> 18) + f.voice_DC;
	this.v3 = (voice3 * f.voice_scale_s14 >> 18) + f.voice_DC;

	if (!this.enabled) {
		return;
	}

	var Vi = 0;
	var offset = 0;

	switch (this.sum & 0xf) {
		case 0x0:
			Vi = 0;
			offset = Filter.summer_offset[0];
			break;
		case 0x1:
			Vi = this.v1;
			offset = Filter.summer_offset[1];
			break;
		case 0x2:
			Vi = this.v2;
			offset = Filter.summer_offset[1];
			break;
		case 0x3:
			Vi = this.v1 + this.v2;
			offset = Filter.summer_offset[2];
			break;
		case 0x4:
			Vi = this.v3;
			offset = Filter.summer_offset[1];
			break;
		case 0x5:
			Vi = this.v1 + this.v3;
			offset = Filter.summer_offset[2];
			break;
		case 0x6:
			Vi = this.v2 + this.v3;
			offset = Filter.summer_offset[2];
			break;
		case 0x7:
			Vi = this.v1 + this.v2 + this.v3;
			offset = Filter.summer_offset[3];
			break;
		case 0x8:
			Vi = this.ve;
			offset = Filter.summer_offset[1];
			break;
		case 0x9:
			Vi = this.ve + this.v1;
			offset = Filter.summer_offset[2];
			break;
		case 0xa:
			Vi = this.ve + this.v2;
			offset = Filter.summer_offset[2];
			break;
		case 0xb:
			Vi = this.ve + this.v2 + this.v1;
			offset = Filter.summer_offset[3];
			break;
		case 0xc:
			Vi = this.ve + this.v3;
			offset = Filter.summer_offset[2];
			break;
		case 0xd:
			Vi = this.ve + this.v3 + this.v1;
			offset = Filter.summer_offset[3];
			break;
		case 0xe:
			Vi = this.ve + this.v3 + this.v2;
			offset = Filter.summer_offset[3];
			break;
		case 0xf:
			Vi = this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.summer_offset[4];
			break;
	}

	// this should be 3, but turning up to lighten load for now
	//var delta_t_flt = 3;
	var delta_t_flt = 3;

	if(this.sid_model === 0) {
		while (delta_t) {
			if (delta_t < delta_t_flt) {
				delta_t_flt = delta_t;
			}
			// Calculate filter outputs.
			this.solve_integrate_6581_Vlp(delta_t_flt, f);
			this.solve_integrate_6581_Vbp(delta_t_flt, f);
			this.Vhp = f.summer[offset + f.gain[this._8_div_Q][this.Vbp] + this.Vlp + Vi];
			delta_t -= delta_t_flt;
		}
	} else {
		while (delta_t) {
			if (delta_t < delta_t_flt) {
				delta_t_flt = delta_t;
			}
			var w0_delta_t = this.w0 * delta_t_flt >> 2;
			var dVbp = w0_delta_t * (this.Vhp >> 4) >> 14;
			var dVlp = w0_delta_t * (this.Vbp >> 4) >> 14;
			this.Vbp -= dVbp;
			this.Vlp -= dVlp;
			this.Vhp = (this.Vbp * this._1024_div_Q >> 10) - this.Vlp - Vi;
			delta_t -= delta_t_flt;
		}
	}
};

Filter.prototype.input = function(sample) {
	var f = Filter.model[this.sid_model];
	this.ve = (sample * f.voice_scale_s14 * 3 >> 14) + f.mixer[0];
};

Filter.prototype.output = function() {
	var f = Filter.model[this.sid_model];

	var Vi = 0;
	var offset = 0;

	switch (this.mix & 0x7f) {
		case 0x00:
			Vi = 0;
			offset = Filter.mixer_offset[0];
			break;
		case 0x01:
			Vi = this.v1;
			offset = Filter.mixer_offset[1];
			break;
		case 0x02:
			Vi = this.v2;
			offset = Filter.mixer_offset[1];
			break;
		case 0x03:
			Vi = this.v2 + this.v1;
			offset = Filter.mixer_offset[2];
			break;
		case 0x04:
			Vi = this.v3;
			offset = Filter.mixer_offset[1];
			break;
		case 0x05:
			Vi = this.v3 + this.v1;
			offset = Filter.mixer_offset[2];
			break;
		case 0x06:
			Vi = this.v3 + this.v2;
			offset = Filter.mixer_offset[2];
			break;
		case 0x07:
			Vi = this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x08:
			Vi = this.ve;
			offset = Filter.mixer_offset[1];
			break;
		case 0x09:
			Vi = this.ve + this.v1;
			offset = Filter.mixer_offset[2];
			break;
		case 0x0a:
			Vi = this.ve + this.v2;
			offset = Filter.mixer_offset[2];
			break;
		case 0x0b:
			Vi = this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x0c:
			Vi = this.ve + this.v3;
			offset = Filter.mixer_offset[2];
			break;
		case 0x0d:
			Vi = this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x0e:
			Vi = this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x0f:
			Vi = this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x10:
			Vi = this.Vlp;
			offset = Filter.mixer_offset[1];
			break;
		case 0x11:
			Vi = this.Vlp + this.v1;
			offset = Filter.mixer_offset[2];
			break;
		case 0x12:
			Vi = this.Vlp + this.v2;
			offset = Filter.mixer_offset[2];
			break;
		case 0x13:
			Vi = this.Vlp + this.v2 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x14:
			Vi = this.Vlp + this.v3;
			offset = Filter.mixer_offset[2];
			break;
		case 0x15:
			Vi = this.Vlp + this.v3 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x16:
			Vi = this.Vlp + this.v3 + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x17:
			Vi = this.Vlp + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x18:
			Vi = this.Vlp + this.ve;
			offset = Filter.mixer_offset[2];
			break;
		case 0x19:
			Vi = this.Vlp + this.ve + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x1a:
			Vi = this.Vlp + this.ve + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x1b:
			Vi = this.Vlp + this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x1c:
			Vi = this.Vlp + this.ve + this.v3;
			offset = Filter.mixer_offset[3];
			break;
		case 0x1d:
			Vi = this.Vlp + this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x1e:
			Vi = this.Vlp + this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x1f:
			Vi = this.Vlp + this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x20:
			Vi = this.Vbp;
			offset = Filter.mixer_offset[1];
			break;
		case 0x21:
			Vi = this.Vbp + this.v1;
			offset = Filter.mixer_offset[2];
			break;
		case 0x22:
			Vi = this.Vbp + this.v2;
			offset = Filter.mixer_offset[2];
			break;
		case 0x23:
			Vi = this.Vbp + this.v2 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x24:
			Vi = this.Vbp + this.v3;
			offset = Filter.mixer_offset[2];
			break;
		case 0x25:
			Vi = this.Vbp + this.v3 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x26:
			Vi = this.Vbp + this.v3 + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x27:
			Vi = this.Vbp + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x28:
			Vi = this.Vbp + this.ve;
			offset = Filter.mixer_offset[2];
			break;
		case 0x29:
			Vi = this.Vbp + this.ve + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x2a:
			Vi = this.Vbp + this.ve + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x2b:
			Vi = this.Vbp + this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x2c:
			Vi = this.Vbp + this.ve + this.v3;
			offset = Filter.mixer_offset[3];
			break;
		case 0x2d:
			Vi = this.Vbp + this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x2e:
			Vi = this.Vbp + this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x2f:
			Vi = this.Vbp + this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x30:
			Vi = this.Vbp + this.Vlp;
			offset = Filter.mixer_offset[2];
			break;
		case 0x31:
			Vi = this.Vbp + this.Vlp + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x32:
			Vi = this.Vbp + this.Vlp + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x33:
			Vi = this.Vbp + this.Vlp + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x34:
			Vi = this.Vbp + this.Vlp + this.v3;
			offset = Filter.mixer_offset[3];
			break;
		case 0x35:
			Vi = this.Vbp + this.Vlp + this.v3 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x36:
			Vi = this.Vbp + this.Vlp + this.v3 + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x37:
			Vi = this.Vbp + this.Vlp + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x38:
			Vi = this.Vbp + this.Vlp + this.ve;
			offset = Filter.mixer_offset[3];
			break;
		case 0x39:
			Vi = this.Vbp + this.Vlp + this.ve + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x3a:
			Vi = this.Vbp + this.Vlp + this.ve + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x3b:
			Vi = this.Vbp + this.Vlp + this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x3c:
			Vi = this.Vbp + this.Vlp + this.ve + this.v3;
			offset = Filter.mixer_offset[4];
			break;
		case 0x3d:
			Vi = this.Vbp + this.Vlp + this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x3e:
			Vi = this.Vbp + this.Vlp + this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[5];
			break;
		case 0x3f:
			Vi = this.Vbp + this.Vlp + this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[6];
			break;
		case 0x40:
			Vi = this.Vhp;
			offset = Filter.mixer_offset[1];
			break;
		case 0x41:
			Vi = this.Vhp + this.v1;
			offset = Filter.mixer_offset[2];
			break;
		case 0x42:
			Vi = this.Vhp + this.v2;
			offset = Filter.mixer_offset[2];
			break;
		case 0x43:
			Vi = this.Vhp + this.v2 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x44:
			Vi = this.Vhp + this.v3;
			offset = Filter.mixer_offset[2];
			break;
		case 0x45:
			Vi = this.Vhp + this.v3 + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x46:
			Vi = this.Vhp + this.v3 + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x47:
			Vi = this.Vhp + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x48:
			Vi = this.Vhp + this.ve;
			offset = Filter.mixer_offset[2];
			break;
		case 0x49:
			Vi = this.Vhp + this.ve + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x4a:
			Vi = this.Vhp + this.ve + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x4b:
			Vi = this.Vhp + this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x4c:
			Vi = this.Vhp + this.ve + this.v3;
			offset = Filter.mixer_offset[3];
			break;
		case 0x4d:
			Vi = this.Vhp + this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x4e:
			Vi = this.Vhp + this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x4f:
			Vi = this.Vhp + this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x50:
			Vi = this.Vhp + this.Vlp;
			offset = Filter.mixer_offset[2];
			break;
		case 0x51:
			Vi = this.Vhp + this.Vlp + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x52:
			Vi = this.Vhp + this.Vlp + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x53:
			Vi = this.Vhp + this.Vlp + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x54:
			Vi = this.Vhp + this.Vlp + this.v3;
			offset = Filter.mixer_offset[3];
			break;
		case 0x55:
			Vi = this.Vhp + this.Vlp + this.v3 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x56:
			Vi = this.Vhp + this.Vlp + this.v3 + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x57:
			Vi = this.Vhp + this.Vlp + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x58:
			Vi = this.Vhp + this.Vlp + this.ve;
			offset = Filter.mixer_offset[3];
			break;
		case 0x59:
			Vi = this.Vhp + this.Vlp + this.ve + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x5a:
			Vi = this.Vhp + this.Vlp + this.ve + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x5b:
			Vi = this.Vhp + this.Vlp + this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x5c:
			Vi = this.Vhp + this.Vlp + this.ve + this.v3;
			offset = Filter.mixer_offset[4];
			break;
		case 0x5d:
			Vi = this.Vhp + this.Vlp + this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x5e:
			Vi = this.Vhp + this.Vlp + this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[5];
			break;
		case 0x5f:
			Vi = this.Vhp + this.Vlp + this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[6];
			break;
		case 0x60:
			Vi = this.Vhp + this.Vbp;
			offset = Filter.mixer_offset[2];
			break;
		case 0x61:
			Vi = this.Vhp + this.Vbp + this.v1;
			offset = Filter.mixer_offset[3];
			break;
		case 0x62:
			Vi = this.Vhp + this.Vbp + this.v2;
			offset = Filter.mixer_offset[3];
			break;
		case 0x63:
			Vi = this.Vhp + this.Vbp + this.v2 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x64:
			Vi = this.Vhp + this.Vbp + this.v3;
			offset = Filter.mixer_offset[3];
			break;
		case 0x65:
			Vi = this.Vhp + this.Vbp + this.v3 + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x66:
			Vi = this.Vhp + this.Vbp + this.v3 + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x67:
			Vi = this.Vhp + this.Vbp + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x68:
			Vi = this.Vhp + this.Vbp + this.ve;
			offset = Filter.mixer_offset[3];
			break;
		case 0x69:
			Vi = this.Vhp + this.Vbp + this.ve + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x6a:
			Vi = this.Vhp + this.Vbp + this.ve + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x6b:
			Vi = this.Vhp + this.Vbp + this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x6c:
			Vi = this.Vhp + this.Vbp + this.ve + this.v3;
			offset = Filter.mixer_offset[4];
			break;
		case 0x6d:
			Vi = this.Vhp + this.Vbp + this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x6e:
			Vi = this.Vhp + this.Vbp + this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[5];
			break;
		case 0x6f:
			Vi = this.Vhp + this.Vbp + this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[6];
			break;
		case 0x70:
			Vi = this.Vhp + this.Vbp + this.Vlp;
			offset = Filter.mixer_offset[3];
			break;
		case 0x71:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.v1;
			offset = Filter.mixer_offset[4];
			break;
		case 0x72:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.v2;
			offset = Filter.mixer_offset[4];
			break;
		case 0x73:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.v2 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x74:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.v3;
			offset = Filter.mixer_offset[4];
			break;
		case 0x75:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.v3 + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x76:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.v3 + this.v2;
			offset = Filter.mixer_offset[5];
			break;
		case 0x77:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[6];
			break;
		case 0x78:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve;
			offset = Filter.mixer_offset[4];
			break;
		case 0x79:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve + this.v1;
			offset = Filter.mixer_offset[5];
			break;
		case 0x7a:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve + this.v2;
			offset = Filter.mixer_offset[5];
			break;
		case 0x7b:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve + this.v2 + this.v1;
			offset = Filter.mixer_offset[6];
			break;
		case 0x7c:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve + this.v3;
			offset = Filter.mixer_offset[5];
			break;
		case 0x7d:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve + this.v3 + this.v1;
			offset = Filter.mixer_offset[6];
			break;
		case 0x7e:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve + this.v3 + this.v2;
			offset = Filter.mixer_offset[6];
			break;
		case 0x7f:
			Vi = this.Vhp + this.Vbp + this.Vlp + this.ve + this.v3 + this.v2 + this.v1;
			offset = Filter.mixer_offset[7];
			break;
	}
	if (this.sid_model === 0) {
		// FIXME: possible cast issue warning
		return Math.floor(f.gain[this.vol][f.mixer[offset + Vi]] - (1 << 15));
	} else {
		return Vi * this.vol >> 4;
	}
};

// Solve VLP against VBP
Filter.prototype.solve_integrate_6581_Vlp = function(dt, mf) {
	var kVddt = Math.floor(mf.kVddt);
	var Vgst = ((kVddt - this.Vlp_x) & 0xffffffff) >>> 0;
	var Vgdt = ((kVddt - this.Vbp) & 0xffffffff) >>> 0;
	var Vgdt_2 = ((Vgdt * Vgdt) & 0xffffffff) >>> 0;
	var n_I_snake = mf.n_snake * (((((Vgst * Vgst) & 0xffffffff) - Vgdt_2) & 0xffffffff) >> 15);
	var kVg = mf.vcr_kVg[(this.Vddt_Vw_2 + (Vgdt_2 >> 1)) >>> 16];
	var Vgs = kVg - this.Vlp_x;
	if (Vgs < 0) Vgs = 0;
	var Vgd = kVg - this.Vbp;
	if (Vgd < 0) Vgd = 0;
	var n_I_vcr = (mf.vcr_n_Ids_term[Vgs] - mf.vcr_n_Ids_term[Vgd]) << 15;
	this.Vlp_vc -= (n_I_snake + n_I_vcr) * dt;
	this.Vlp_vc &= 0xffffffff;
	this.Vlp_x = mf.opamp_rev[((this.Vlp_vc >> 15) + (1 << 15)) & 0xFFFF];
	this.Vlp = this.Vlp_x + (this.Vlp_vc >> 14);
};

// Solve VBP against VHP
Filter.prototype.solve_integrate_6581_Vbp = function(dt, mf) {
	var kVddt = Math.floor(mf.kVddt);
	var Vgst = ((kVddt - this.Vbp_x) & 0xffffffff) >>> 0;
	var Vgdt = ((kVddt - this.Vhp) & 0xffffffff) >>> 0;
	var Vgdt_2 = ((Vgdt * Vgdt) & 0xffffffff) >>> 0;
	var n_I_snake = mf.n_snake * (((((Vgst * Vgst) & 0xffffffff) - Vgdt_2) & 0xffffffff) >> 15);
	var kVg = mf.vcr_kVg[(this.Vddt_Vw_2 + (Vgdt_2 >> 1)) >>> 16];
	var Vgs = (kVg - this.Vbp_x) & 0xffffffff;
	if (Vgs < 0) Vgs = 0;
	var Vgd = (kVg - this.Vhp) & 0xffffffff;
	if (Vgd < 0) Vgd = 0;
	var n_I_vcr = (mf.vcr_n_Ids_term[Vgs] - mf.vcr_n_Ids_term[Vgd]) << 15;
	this.Vbp_vc -= (n_I_snake + n_I_vcr) * dt;
	this.Vbp_vc &= 0xffffffff;
	this.Vbp_x = mf.opamp_rev[((this.Vbp_vc >> 15) + (1 << 15)) & 0xFFFF];
	this.Vbp = this.Vbp_x + (this.Vbp_vc >> 14);
};


// Main Object
function ReSID (sampleRate, clkRate, method) {
	sampleRate = sampleRate || 44100;
	clkRate = clkRate || jsSID.chip.clock.PAL;
	method = method || ReSID.sampling_method.SAMPLE_FAST;

	this.sample = 0;
	this.fir = 0;
	this.fir_N = 0;
	this.fir_RES = 0;
	this.fir_beta = 0;
	this.fir_f_cycles_per_sample = 0;
	this.fir_filter_scale = 0;


	this.bus_value = 0;
	this.bus_value_ttl = 0;
	this.write_pipeline = 0;

	this.sid_model = jsSID.chip.model.MOS6581;

	this.voice = new Array(3);
	for(var i = 0; i < 3; i++) {
		this.voice[i] = new Voice();
	}
	this.filter = new Filter();
	this.extfilt = new ExternalFilter();
	this.voice[0].set_sync_source(this.voice[2]);
	this.voice[1].set_sync_source(this.voice[0]);
	this.voice[2].set_sync_source(this.voice[1]);

	this.set_chip_model(jsSID.chip.model.MOS6581);

	// FIXME: hardcoded sample method. should be options.
	this.set_sampling_parameters(clkRate, method, sampleRate);
}
//FIXME: original had destructor calling "delete[] sample; delete fir[]". Shouldn't matter we don't.

jsSID.chip.model = Object.freeze({ MOS6581: 0, MOS8580: 1 });
ReSID.const = Object.freeze({
	FIR_N: 125,
	FIR_RES: 285,
	FIR_RES_FASTMEM: 51473,
	FIR_SHIFT: 15,
	RINGSIZE: (1 << 14),
	RINGMASK: (1 << 14) - 1,
	FIXP_SHIFT: 16,
	FIXP_MASK: 0xffff
});
ReSID.sampling_method = Object.freeze({
	SAMPLE_FAST: {},
	SAMPLE_INTERPOLATE: {},
	SAMPLE_RESAMPLE: {},
	SAMPLE_RESAMPLE_FASTMEM: {}
});

// hack to let players work while we switch NG in and out
SID = { quality: ReSID.quality, factory: ReSID.factory, const: ReSID.const };

ReSID.prototype.set_chip_model = function(model) {
	this.sid_model = model;
	for (var i = 0; i < 3; i++) {
		this.voice[i].set_chip_model(model);
	}
	this.filter.set_chip_model(model);
};

ReSID.prototype.reset = function() {
	for (var i = 0; i < 3; i++) {
		this.voice[i].reset();
	}
	this.filter.reset();
	this.extfilt.reset();
	this.bus_value = 0;
	this.bus_value_ttl = 0;
};

ReSID.prototype.input = function(sample) {
	this.filter.input(sample);
};

ReSID.prototype.set_voice_mask = function(mask) {
	this.filter.set_voice_mask(mask);
};

ReSID.prototype.adjust_filter_biad = function(dac_bias) {
	this.filter.adjust_filter_bias(dac_bias);
};


ReSID.prototype.read = function(offset) {
	switch (offset) {
			// We don't model the potentiometers
		case 0x19:
		case 0x1a:
			return 0xFF;
		case 0x1b:
			return this.voice[2].wave.readOSC();
		case 0x1c:
			return this.voice[2].envelope.readENV();
		default:
			return this.bus_value;
	}
};

ReSID.prototype.poke = function(offset, value) {
	this.write(offset, value);
};

ReSID.prototype.pokeDigi = function(offset, value) {
	// not yet implemented
	return;
};

ReSID.prototype.write = function(offset, value) {
	this.write_address = offset;
	this.bus_value = value;
	this.bus_value_ttl = 0x4000;
	if (this.sid_model == jsSID.chip.model.MOS8580) {
		this.write_pipeline = 1;
	} else {
		this.write_commit();
	}
};

ReSID.prototype.write_commit = function() {
	switch (this.write_address) {
		case 0x00:
			this.voice[0].wave.writeFREQ_LO(this.bus_value);
			break;
		case 0x01:
			this.voice[0].wave.writeFREQ_HI(this.bus_value);
			break;
		case 0x02:
			this.voice[0].wave.writePW_LO(this.bus_value);
			break;
		case 0x03:
			this.voice[0].wave.writePW_HI(this.bus_value);
			break;
		case 0x04:
			this.voice[0].writeCONTROL_REG(this.bus_value);
			break;
		case 0x05:
			this.voice[0].envelope.writeATTACK_DECAY(this.bus_value);
			break;
		case 0x06:
			this.voice[0].envelope.writeSUSTAIN_RELEASE(this.bus_value);
			break;
		case 0x07:
			this.voice[1].wave.writeFREQ_LO(this.bus_value);
			break;
		case 0x08:
			this.voice[1].wave.writeFREQ_HI(this.bus_value);
			break;
		case 0x09:
			this.voice[1].wave.writePW_LO(this.bus_value);
			break;
		case 0x0a:
			this.voice[1].wave.writePW_HI(this.bus_value);
			break;
		case 0x0b:
			this.voice[1].writeCONTROL_REG(this.bus_value);
			break;
		case 0x0c:
			this.voice[1].envelope.writeATTACK_DECAY(this.bus_value);
			break;
		case 0x0d:
			this.voice[1].envelope.writeSUSTAIN_RELEASE(this.bus_value);
			break;
		case 0x0e:
			this.voice[2].wave.writeFREQ_LO(this.bus_value);
			break;
		case 0x0f:
			this.voice[2].wave.writeFREQ_HI(this.bus_value);
			break;
		case 0x10:
			this.voice[2].wave.writePW_LO(this.bus_value);
			break;
		case 0x11:
			this.voice[2].wave.writePW_HI(this.bus_value);
			break;
		case 0x12:
			this.voice[2].writeCONTROL_REG(this.bus_value);
			break;
		case 0x13:
			this.voice[2].envelope.writeATTACK_DECAY(this.bus_value);
			break;
		case 0x14:
			this.voice[2].envelope.writeSUSTAIN_RELEASE(this.bus_value);
			break;
		case 0x15:
			this.filter.writeFC_LO(this.bus_value);
			break;
		case 0x16:
			this.filter.writeFC_HI(this.bus_value);
			break;
		case 0x17:
			this.filter.writeRES_FILT(this.bus_value);
			break;
		case 0x18:
			this.filter.writeMODE_VOL(this.bus_value);
			break;
		default:
			break;
	}
	this.write_pipeline = 0;
};

ReSID.prototype.enable_filter = function(enable) {
	this.filter.enable_filter(enable);
};

ReSID.prototype.enable_external_filter = function(enable) {
	this.extfilt.enable_filter(enable);
};

ReSID.prototype.I0 = function(x) {
	var I0e = 1e-6;			// FIXME: const, used once
	var sum = 1;
	var u = 1;
	var n = 1;
	var halfx = x / 2.0;
	var temp;
	do {
		temp = halfx / n++;
		u *= temp * temp;
		sum += u;
	} while (u >= I0e * sum);
	return sum;
};


// Use a clock freqency of 985248Hz for PAL C64, 1022730Hz for NTSC C64.
ReSID.prototype.set_sampling_parameters = function(clock_freq, method, sample_freq, pass_freq, filter_scale) {
	pass_freq = pass_freq || -1;
	filter_scale = filter_scale || 0.97;

	if (method == ReSID.sampling_method.SAMPLE_RESAMPLE || method == ReSID.sampling_method.SAMPLE_RESAMPLE_FASTMEM) {
		if (ReSID.const.FIR_N * clock_freq / sample_freq >= ReSID.const.RINGSIZE) {
			return false;
		}
		if (pass_freq < 0) {
			pass_freq = 20000;
			if (2 * pass_freq / sample_freq >= 0.9) {
				pass_freq = 0.9 * sample_freq / 2;
			}
		} else if (pass_freq > 0.9 * sample_freq / 2) {
			return false;
		}
		if (filter_scale < 0.9 || filter_scale > 1.0) {
			return false;
		}
	}

	this.clock_frequency = clock_freq;
	this.mix_freq = sample_freq;
	this.sampling = method;
	this.cycles_per_sample = Math.floor(clock_freq / sample_freq * (1 << ReSID.const.FIXP_SHIFT) + 0.5);
	this.sample_offset = 0;
	this.sample_prev = 0;
	this.sample_now = 0;

	if (method != ReSID.sampling_method.SAMPLE_RESAMPLE && method != ReSID.sampling_method.SAMPLE_RESAMPLE_FASTMEM) {
		this.sample = 0;
		this.fir = 0;
		return true;
	}

	// Allocate sample buffer.
	if (!this.sample) {
		this.sample = new Array(ReSID.const.RINGSIZE * 2);
	}
	// Clear sample buffer.
	for (var j = 0; j < ReSID.const.RINGSIZE * 2; j++) {
		this.sample[j] = 0;
	}
	this.sample_index = 0;

	var A = -20 * (Math.log(1.0 / (1 << 16)) / Math.LN10);		// FIXME: constant
	var dw = (1 - 2 * pass_freq / sample_freq) * Math.PI * 2;
	var wc = Math.PI;
	var beta = 0.1102 * (A - 8.7);			// FIXME: constant
	var I0beta = this.I0(beta);				// FIXME: constant
	var N = Math.floor((A - 7.95) / (2.285 * dw) + 0.5);
	N += N & 1;

	var f_samples_per_cycle = sample_freq / clock_freq;
	var f_cycles_per_sample = clock_freq / sample_freq;
	// FIXME: cast int became floor
	var fir_N_new = Math.floor(N * f_cycles_per_sample) + 1;
	fir_N_new |= 1;


	var res = (method == ReSID.sampling_method.SAMPLE_RESAMPLE) ? ReSID.const.FIR_RES : ReSID.const.FIR_RES_FASTMEM;
	var n = Math.ceil(Math.log(res / f_cycles_per_sample) / Math.log(2.0));
	var fir_RES_new = 1 << n;

	if (this.fir && 
		fir_RES_new == this.fir_RES &&
		fir_N_new == this.fir_N && 
		beta == this.fir_beta && 
		f_cycles_per_sample == this.fir_f_cycles_per_sample &&
		this.fir_filter_scale == filter_scale) {
		return true;
	}
	this.fir_RES = fir_RES_new;
	this.fir_N = fir_N_new;
	this.fir_beta = beta;
	this.fir_f_cycles_per_sample = f_cycles_per_sample;
	this.fir_filter_scale = filter_scale;

	this.fir = new Array(this.fir_N * this.fir_RES);

	for (var i = 0; i < this.fir_RES; i++) {
		var fir_offset = i * this.fir_N + this.fir_N / 2;
		// FIXME: i below was cast to double before. should be ok, clean up when confirmed
		var j_offset = i / this.fir_RES;
		for (var j = -this.fir_N / 2; j <= this.fir_N / 2; j++) {
			var jx = j - j_offset;
			var wt = wc * jx / f_cycles_per_sample;
			var temp = jx / (this.fir_N / 2);
			var Kaiser = Math.abs(temp) <= 1 ? this.I0(beta * Math.sqrt(1 - temp * temp)) / I0beta : 0;
			var sincwt = Math.abs(wt) >= 1e-6 ? Math.sin(wt) / wt : 1;
			var val = (1 << ReSID.const.FIR_SHIFT) * filter_scale * f_samples_per_cycle * wc / Math.PI * sincwt * Kaiser;
			// FIXME: was a cast to short, convered to Math.floor. Clean once confirmed
			this.fir[fir_offset + j] = (val >= 0.0) ? Math.floor(val + 0.5) : Math.ceil(val - 0.5);
		}
	}

	return true;
};

ReSID.prototype.adjust_sampling_frequency = function(sample_freq) {
	this.cycles_per_sample = Math.floor(this.clock_frequency / sample_freq*(1 << ReSID.const.FIXP_SHIFT) + 0.5);
};


ReSID.prototype.clock_one = function() {
	var i;
	for (i = 0; i < 3; i++) {
		this.voice[i].envelope.clock_one();
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].wave.clock_one();
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].wave.synchronize();
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].wave.set_waveform_output_one();
	}
	this.filter.clock_one(this.voice[0].output(), this.voice[1].output(), this.voice[2].output());
	this.extfilt.clock_one(this.filter.output());

	if(this.write_pipeline) {
		this.write_commit();
	}

	if (!--this.bus_value_ttl) {
		this.bus_value = 0;
		this.bus_value_ttl = 0;
	}



};

ReSID.prototype.output = function() {
	return this.extfilt.output();
};


ReSID.prototype.clock_delta = function(delta_t) {
	var i;

	if (this.write_pipeline && (delta_t > 0)) {
		// Step one cycle by a recursive call to ourselves.
		// FIXME: why? whe have single clock call. check this doesnt get wierd...
		this.write_pipeline = 0;
		this.clock(1);
		this.write();
		delta_t -= 1;
	}

	if (delta_t <= 0) return;

	this.bus_value_ttl -= delta_t;
	if (this.bus_value_ttl <= 0) {
		this.bus_value = 0;
		this.bus_value_ttl = 0;
	}

	// Clock amplitude modulators.
	for (i = 0; i < 3; i++) {
		this.voice[i].envelope.clock_delta(delta_t);
	}

	// Clock and synchronize oscillators.
	// Loop until we reach the current cycle.
	var delta_t_osc = delta_t;
	while (delta_t_osc) {
		var delta_t_min = delta_t_osc;
		for (i = 0; i < 3; i++) {
			var wave = this.voice[i].wave;

			if (!(wave.sync_dest.sync && wave.freq)) {
				continue;
			}

			var freq = wave.freq;
			var accumulator = wave.accumulator;
			var delta_accumulator = (accumulator & 0x800000 ? 0x1000000 : 0x800000) - accumulator;
			var delta_t_next = delta_accumulator/freq;

			if (delta_accumulator % freq) {
				++delta_t_next;
			}

			if (delta_t_next < delta_t_min) {
				delta_t_min = delta_t_next;
			}
		}

		// Clock oscillators.
		for (i = 0; i < 3; i++) {
			this.voice[i].wave.clock_delta(delta_t_min);
		}

		// Synchronize oscillators.
		for (i = 0; i < 3; i++) {
			this.voice[i].wave.synchronize();
		}

		delta_t_osc -= delta_t_min;
	}

	for (i = 0; i < 3; i++) {
		this.voice[i].wave.set_waveform_output_delta(delta_t);
	}

	// Clock filter.
	this.filter.clock_delta(this.voice[0].output(), this.voice[1].output(), this.voice[2].output(), delta_t);

	// Clock external filter.
	this.extfilt.clock_delta(this.filter.output(), delta_t);

};

ReSID.prototype.clock = function(delta_t, buf, n, interleave, buf_offset) {
	interleave = interleave || 1;
	buf_offset = buf_offset || 0;
	switch (this.sampling) {
		default:
		case ReSID.sampling_method.SAMPLE_FAST:
			return this.clock_fast(delta_t, buf, n, interleave, buf_offset);
		case ReSID.sampling_method.SAMPLE_INTERPOLATE:
			return this.clock_interpolate(delta_t, buf, n, interleave, buf_offset);
		case ReSID.sampling_method.SAMPLE_RESAMPLE:
			return this.clock_resample(delta_t, buf, n, interleave, buf_offset);
		case ReSID.sampling_method.SAMPLE_RESAMPLE_FASTMEM:
			return this.clock_resample_fastmem(delta_t, buf, n, interleave, buf_offset);
	}
};

ReSID.prototype.clock_fast = function(delta_t, buf, n, interleave, buf_offset) {
	var s;
	for (s = 0; s < n; s++) {
		var next_sample_offset = (this.sample_offset + this.cycles_per_sample + (1 << (ReSID.const.FIXP_SHIFT - 1))) & 0xffffffff;
		var delta_t_sample = next_sample_offset >> ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			delta_t_sample = delta_t;
		}
		this.clock_delta(delta_t_sample);
		if((delta_t -= delta_t_sample) === 0) {
			this.sample_offset -= delta_t_sample << ReSID.const.FIXP_SHIFT;
			break;
		}
		this.sample_offset = ((next_sample_offset & ReSID.const.FIXP_MASK) - (1 << (ReSID.const.FIXP_SHIFT - 1))) & 0xffffffff;
		// new sample output w/ offset
		var final_sample = parseFloat(this.output()) / 32768;
		var buf_idx = s * interleave * 2 + buf_offset;
		buf[buf_idx] = final_sample;
		buf[buf_idx + 1] = final_sample;
	}
	return s;
};


ReSID.prototype.clock_interpolate = function(delta_t, buf, n, interleave, buf_offset) {
	var s;
	for (s = 0; s < n; s++) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			delta_t_sample = delta_t;
		}
		for (var i = delta_t_sample; i > 0; i--) {
			this.clock_one();
			if (i <= 2) {
				this.sample_prev = this.sample_now;
				this.sample_now = output();
			}
		}
		if ((delta_t -= delta_t_sample) === 0) {
			this.sample_offset -= delta_t_sample << ReSID.const.FIXP_SHIFT;
			break;
		}
		this.sample_offset = next_sample_offset & ReSID.const.FIXP_MASK;
		// new sample output w/ offset
		var final_sample = (this.sample_prev + (this.sample_offset * (this.sample_now - this.sample_prev) >> ReSID.const.FIXP_SHIFT)) / 32768;
		var buf_idx = s * interleave * 2 + buf_offset;
		buf[buf_idx] = final_sample;
		buf[buf_idx + 1] = final_sample;
	}
	return s;

};


ReSID.prototype.clock_resample = function(delta_t, buf, n, interleave, buf_offset) {
	var s;
	for (s = 0; s < n; s++) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			delta_t_sample = delta_t;
		}

		for (var i = 0; i < delta_t_sample; i++) {
			this.clock_one();
			this.sample[this.sample_index] = this.output();
			this.sample[this.sample_index + ReSID.const.RINGSIZE] = this.sample[this.sample_index];
			++this.sample_index;
			this.sample_index &= ReSID.const.RINGMASK;
		}

		if ((delta_t -= delta_t_sample) === 0) {
			this.sample_offset -= delta_t_sample << ReSID.const.FIXP_SHIFT;
			break;
		}

		this.sample_offset = next_sample_offset & ReSID.const.FIXP_MASK;

		var fir_offset = this.sample_offset * this.fir_RES >> ReSID.const.FIXP_SHIFT;
		var fir_offset_rmd = this.sample_offset * this.fir_RES & ReSID.const.FIXP_MASK;
		var fir_start = fir_offset * this.fir_N;
		var sample_start = this.sample_index - this.fir_N - 1 + ReSID.const.RINGSIZE;

		var v1 = 0;
		for (var j = 0; j < this.fir_N; j++) {
			v1 += this.sample[sample_start + j] * this.fir[fir_start + j];
		}
		if (++fir_offset == this.fir_RES) {
			fir_offset = 0;
			++sample_start;
		}

		fir_start = fir_offset * this.fir_N;
	
		var v2 = 0;
		for (var k = 0; k < this.fir_N; k++) {
			v2 += this.sample[sample_start + k] * this.fir[fir_start + k];
		}
		var v = v1 + (fir_offset_rmd * (v2 - v1) >> ReSID.const.FIXP_SHIFT);
		v >>= ReSID.const.FIR_SHIFT;

		// FIXME constant here
		var half = 1 << 15;
		if (v >= half) {
			v = half - 1;
		} else if (v < -half) {
			v = -half;
		}
		// new sample output w/ offset
		var final_sample = v / 32768;
		var buf_idx = s * interleave * 2 + buf_offset;
		buf[buf_idx] = final_sample;
		buf[buf_idx + 1] = final_sample;
	}
	return s;
};

ReSID.prototype.clock_resample_fast = function(delta_t, buf, n, interleave, buf_offset) {
	var s;
	for (s = 0; s < n; s++) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			delta_t_sample = delta_t;
		}
		for (var i = 0; i < delta_t_sample; i++) {
			this.clock_one();
			this.sample[this.sample_index] = this.output();
			this.sample[this.sample_index + ReSID.const.RINGSIZE] = this.sample[this.sample_index];
			++this.sample_index;
			this.sample_index &= ReSID.const.RINGMASK;
		}
		if ((delta_t -= delta_t_sample) === 0) {
			sample_offset -= delta_t_sample << ReSID.const.FIXP_SHIFT;
			break;
		}
		this.sample_offset = next_sample_offset & ReSID.const.FIXP_MASK;
		var fir_offset = this.sample_offset * this.fir_RES >> ReSID.const.FIXP_SHIFT;
		var fir_start = this.fir_offset * this.fir_N;
		var sample_start = this.sample_index - this.fir_N + ReSID.const.RINGSIZE;
		var v = 0;
		for (var j = 0; j < this.fir_N; j++) {
			v += this.sample[sample_start + j] * this.fir[fir_start + j];
		}
		v >>= ReSID.const.FIR_SHIFT;

		var half = 1 << 15;			// FIXME: const
		if (v >= half) {
			v = half - 1;
		} else if (v < -half) {
			v = -half;
		}
		// new sample output w/ offset
		var final_sample = parseFloat(v) / 32768;
		var buf_idx = s * interleave * 2 + buf_offset;
		buf[buf_idx] = final_sample;
		buf[buf_idx + 1] = final_sample;
	}
	return s;
};

// generate count samples into buffer at offset
ReSID.prototype.generateIntoBuffer = function(count, buffer, offset) {
        //console.log("ReSID.generateIntoBuffer (count: " + count + ", offset: " + offset + ")");
        // FIXME: this could be done in one pass. (No?)
        for (var i = offset; i < offset + count * 2; i++) {
                buffer[i] = 0;
        }
	var delta = (this.cycles_per_sample * count) >> ReSID.const.FIXP_SHIFT;
	var s = this.clock(delta, buffer, count, 1, offset);
        //console.log("ReSID.generateIntoBuffer (delta: " + delta + ", samples clocked: " + s + ")");
	return s;
};

ReSID.prototype.generate = function(samples) {
        var data = new Array(samples*2);
        this.generateIntoBuffer(samples, data, 0);
        return data;
};


