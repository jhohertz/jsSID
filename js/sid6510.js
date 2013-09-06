
function Sid6510(mem, sid) {

	// other internal values
	this.cycles = 0;
	this.bval = 0;
	this.wval = 0;

	if(mem) {
		this.mem = mem;
	} else {
		this.mem = new Array(65536);
		for(var i=0; i<65536; i++) {
			memory[i]=0;
		}
	}

	if(sid) {
		this.sid = sid;
	} else {
		this.sid = null;
	}

	this.cpuReset();

}

Sid6510.prototype.getmem = function(addr) {
	if (addr == 0xdd0d) {
		this.mem[addr] = 0;
	}
	return this.mem[addr];
};

Sid6510.prototype.setmem = function(addr, value) {
	this.mem[addr] = value;

	if ((addr & 0xfc00) == 0xd400 && this.sid != null) {
		this.sid.poke(addr & 0x1f, value);
		if ((addr > 0xd418) && (addr < 0xd500)) {
			this.sid.pokeDigi(addr, value);
		}
	}

};

Sid6510.prototype.getaddr = function(mode) {

	var ad,ad2;
	switch(mode) {
		case Sid6510.mode.imp:
			this.cycles += 2;
			return 0;
		case Sid6510.mode.imm:
			this.cycles += 2;
			return this.getmem(this.pc++);
		case Sid6510.mode.abs:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad |= this.getmem(this.pc++) << 8;
			return this.getmem(ad);
		case Sid6510.mode.absx:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad |= 256 * this.getmem(this.pc++);
			ad2 = ad + this.x;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			return this.getmem(ad2);
		case Sid6510.mode.absy:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad |= 256 * this.getmem(this.pc++);
			ad2 = ad + this.y;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			return this.getmem(ad2);
		case Sid6510.mode.zp:
			this.cycles += 3;
			ad = this.getmem(this.pc++);
			return this.getmem(ad);
		case Sid6510.mode.zpx:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad += this.x;
			return this.getmem(ad & 0xff);
		case Sid6510.mode.zpy:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad += this.y;
			return this.getmem(ad & 0xff);
		case Sid6510.mode.indx:
			this.cycles += 6;
			ad = this.getmem(this.pc++);
			ad += this.x;
			ad2 = this.getmem(ad & 0xff);
			ad++;
			ad2 |= this.getmem(ad & 0xff) << 8;
			return this.getmem(ad2);
		case Sid6510.mode.indy:
			this.cycles += 5;
			ad = this.getmem(this.pc++);
			ad2 = this.getmem(ad);
			ad2 |= this.getmem((ad + 1) &0xff) << 8;
			ad = ad2 + this.y;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			return this.getmem(ad);
		case Sid6510.mode.acc:
			this.cycles += 2;
			return this.a;
	}
	return 0;

};

Sid6510.prototype.setaddr = function(mode, val) {
	var ad,ad2;
	switch(mode) {
		case Sid6510.mode.abs:
			this.cycles += 2;
			ad = this.getmem(this.pc - 2);
			ad |= 256 * this.getmem(this.pc - 1);
			this.setmem(ad, val);
			return;
		case Sid6510.mode.absx:
			this.cycles += 3;
			ad = this.getmem(this.pc - 2);
			ad |= 256 * this.getmem(this.pc - 1);
			ad2 = ad + this.x;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles--;
			this.setmem(ad2, val);
			return;
		case Sid6510.mode.zp:
			this.cycles += 2;
			ad = this.getmem(this.pc - 1);
			this.setmem(ad, val);
			return;
		case Sid6510.mode.zpx:
			this.cycles += 2;
			ad = this.getmem(this.pc - 1);
			ad += this.x;
			this.setmem(ad & 0xff, val);
			return;
		case Sid6510.mode.acc:
			this.a = val;
			return;
	}

};

Sid6510.prototype.putaddr = function(mode, val) {
	var ad,ad2;
	switch(mode) {
		case Sid6510.mode.abs:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad |= this.getmem(this.pc++) << 8;
			this.setmem(ad, val);
			return;
		case Sid6510.mode.absx:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad |= this.getmem(this.pc++) << 8;
			ad2 = ad + this.x;
			this.setmem(ad2, val);
			return;
		case Sid6510.mode.absy:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad |= this.getmem(this.pc++) << 8;
			ad2 = ad + this.y;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			this.setmem(ad2, val);
			return;
		case Sid6510.mode.zp:
			this.cycles += 3;
			ad = this.getmem(this.pc++);
			this.setmem(ad, val);
			return;
		case Sid6510.mode.zpx:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad += this.x;
			this.setmem(ad & 0xff, val);
			return;
		case Sid6510.mode.zpy:
			this.cycles += 4;
			ad = this.getmem(this.pc++);
			ad += this.y;
			this.setmem(ad & 0xff,val);
			return;
		case Sid6510.mode.indx:
			this.cycles += 6;
			ad = this.getmem(this.pc++);
			ad += this.x;
			ad2 = this.getmem(ad & 0xff);
			ad++;
			ad2 |= this.getmem(ad & 0xff) << 8;
			this.setmem(ad2, val);
			return;
		case Sid6510.mode.indy:
			this.cycles += 5;
			ad = this.getmem(this.pc++);
			ad2 = this.getmem(ad);
			ad2 |= this.getmem((ad + 1) & 0xff) << 8;
			ad = ad2 + this.y;
			this.setmem(ad, val);
			return;
		case Sid6510.mode.acc:
			this.cycles += 2;
			this.a = val;
			return;
	}
};

Sid6510.prototype.setflags = function(flag, cond) {
	// cond?p|=flag:p&=~flag;
	if (cond) {
		this.p |= flag;
	} else {
		this.p &= ~flag & 0xff;
	}
};

Sid6510.prototype.push = function(val) {
	this.setmem(0x100 + this.s, val);
	if (this.s) this.s--;
};

Sid6510.prototype.pop = function() {
	if (this.s < 0xff) this.s++;
	return this.getmem(0x100 + this.s);
};

Sid6510.prototype.branch = function(flag) {
	var dist = this.getaddr(Sid6510.mode.imm);
	if (dist & 0x80) { dist = 0 - ((~dist & 0xff) + 1) }        // make signed
	this.wval= this.pc + dist;
	if (this.wval < 0) this.wval += 65536			    // FIXME: added boundary checks to wrap around. Not sure this is whats needed
	this.wval &= 0xffff
	if (flag) {
		this.cycles += ((this.pc & 0x100) != (this.wval & 0x100)) ? 2 : 1;
		this.pc = this.wval;
	}
};

Sid6510.prototype.cpuReset = function() {
	this.a	= 0;
	this.x	= 0;
	this.y	= 0;
	this.p	= 0;
	this.s	= 255;
	this.pc	= this.getaddr(0xfffc);
}

Sid6510.prototype.cpuResetTo = function(npc) {
	this.a	= 0;
	this.x	= 0;
	this.y	= 0;
	this.p	= 0;
	this.s	= 255;
	this.pc	= npc;
}

Sid6510.prototype.cpuParse = function() {
	var c;
	this.cycles = 0;

	var opc = this.getmem(this.pc++);
	var cmd = Sid6510.opcodes[opc][0];
	var addr = Sid6510.opcodes[opc][1];

	//console.log(opc, cmd, addr);

	switch (cmd) {
		case Sid6510.inst.adc:
			this.wval = this.a + this.getaddr(addr) + ((this.p & Sid6510.flag.C) ? 1 : 0);
			this.setflags(Sid6510.flag.C, this.wval & 0x100);
			this.a = this.wval & 0xff;
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			this.setflags(Sid6510.flag.V, ((this.p & Sid6510.flag.C) ? 1 : 0) ^ ((this.p & Sid6510.flag.N) ? 1 : 0));
			break;
		case Sid6510.inst.and:
			this.bval = this.getaddr(addr);
			this.a &= this.bval;
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			break;
		case Sid6510.inst.asl:
			this.wval = this.getaddr(addr);
			this.wval <<= 1;
			this.setaddr(addr, this.wval & 0xff);
			this.setflags(Sid6510.flag.Z, !this.wval);
			this.setflags(Sid6510.flag.N, this.wval & 0x80);
			this.setflags(Sid6510.flag.C, this.wval & 0x100);
			break;
		case Sid6510.inst.bcc:
			this.branch(!(this.p & Sid6510.flag.C));
			break;
		case Sid6510.inst.bcs:
			this.branch(this.p & Sid6510.flag.C);
			break;
		case Sid6510.inst.bne:
			this.branch(!(this.p & Sid6510.flag.Z));
			break;
		case Sid6510.inst.beq:
			this.branch(this.p & Sid6510.flag.Z);
			break;
		case Sid6510.inst.bpl:
			this.branch(!(this.p & Sid6510.flag.N));
			break;
		case Sid6510.inst.bmi:
			this.branch(this.p & Sid6510.flag.N);
			break;
		case Sid6510.inst.bvc:
			this.branch(!(this.p & Sid6510.flag.V));
			break;
		case Sid6510.inst.bvs:
			this.branch(this.p & Sid6510.flag.V);
			break;
		case Sid6510.inst.bit:
			this.bval = this.getaddr(addr);
			this.setflags(Sid6510.flag.Z, !(this.a & this.bval));
			this.setflags(Sid6510.flag.N, this.bval & 0x80);
			this.setflags(Sid6510.flag.V, this.bval & 0x40);
			break;
		case Sid6510.inst.brk:
			this.push(this.pc & 0xff);
			this.push(this.pc >> 8);
			this.push(this.p);
			this.setflags(Sid6510.flag.B, 1);
			// FIXME: should Z be set as well?
			this.pc = this.getmem(0xfffe);
			this.cycles += 7;
			break;
		case Sid6510.inst.clc:
			this.cycles += 2;
			this.setflags(Sid6510.flag.C, 0);
			break;
		case Sid6510.inst.cld:
			this.cycles += 2;
			this.setflags(Sid6510.flag.D, 0);
			break;
		case Sid6510.inst.cli:
			this.cycles += 2;
			this.setflags(Sid6510.flag.I, 0);
			break;
		case Sid6510.inst.clv:
			this.cycles += 2;
			this.setflags(Sid6510.flag.V, 0);
			break;
		case Sid6510.inst.cmp:
			this.bval = this.getaddr(addr);
			this.wval = this.a - this.bval;
			if(this.wval < 0) this.wval += 256;		// Simulate 8 bit rollover not really needed?
			this.setflags(Sid6510.flag.Z, !this.wval);
			this.setflags(Sid6510.flag.N, this.wval & 0x80);
			this.setflags(Sid6510.flag.C, this.a >= this.bval);
			break;
		case Sid6510.inst.cpx:
			this.bval = this.getaddr(addr);
			this.wval = this.x - this.bval;
			if(this.wval < 0) this.wval += 256;		// Simulate 8 bit rollover not really needed?
			this.setflags(Sid6510.flag.Z, !this.wval);
			this.setflags(Sid6510.flag.N, this.wval & 0x80);
			this.setflags(Sid6510.flag.C, this.a >= this.bval);
			break;
		case Sid6510.inst.cpy:
			this.bval = this.getaddr(addr);
			this.wval = this.y - this.bval;
			if(this.wval < 0) this.wval += 256;		// Simulate 8 bit rollover not really needed?
			this.setflags(Sid6510.flag.Z, !this.wval);
			this.setflags(Sid6510.flag.N, this.wval & 0x80);
			this.setflags(Sid6510.flag.C, this.a >= this.bval);
			break;
		case Sid6510.inst.dec:
			this.bval = this.getaddr(addr);
			this.bval--;
			if(this.bval < 0) this.bval += 256;		// Simulate 8 bit rollover
			this.setaddr(addr, this.bval);
			this.setflags(Sid6510.flag.Z, !this.bval);
			this.setflags(Sid6510.flag.N, this.bval & 0x80);
			break;
		case Sid6510.inst.dex:
			this.cycles += 2;
			this.x--;
			if(this.x < 0) this.x += 256;		// Simulate 8 bit rollover
			this.setflags(Sid6510.flag.Z, !this.x);
			this.setflags(Sid6510.flag.N, this.x & 0x80);
			break;
		case Sid6510.inst.dey:
			this.cycles += 2;
			this.y--;
			if(this.y < 0) this.y += 256;		// Simulate 8 bit rollover
			this.setflags(Sid6510.flag.Z, !this.y);
			this.setflags(Sid6510.flag.N, this.y & 0x80);
			break;
		case Sid6510.inst.eor:
			this.bval = this.getaddr(addr);
			this.a ^= this.bval;
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			break;
		case Sid6510.inst.inc:
			this.bval = this.getaddr(addr);
			this.bval++;
			this.bval &= 0xff
			this.setaddr(addr, this.bval);
			this.setflags(Sid6510.flag.Z, !this.bval);
			this.setflags(Sid6510.flag.N, this.bval & 0x80);
			break;
		case Sid6510.inst.inx:
			this.cycles += 2;
			this.x++;
			this.x &= 0xff
			this.setflags(Sid6510.flag.Z, !this.x);
			this.setflags(Sid6510.flag.N, this.x & 0x80);
			break;
		case Sid6510.inst.iny:
			this.cycles += 2;
			this.y++;
			this.y &= 0xff
			this.setflags(Sid6510.flag.Z, !this.y);
			this.setflags(Sid6510.flag.N, this.y & 0x80);
			break;
		case Sid6510.inst.jmp:
			this.cycles += 3;
			this.wval = this.getmem(this.pc++);
			this.wval |= 256 * this.getmem(this.pc++);
			switch (addr) {
				case Sid6510.mode.abs:
					this.pc = this.wval;
					break;
				case Sid6510.mode.ind:
					this.pc = this.getmem(this.wval);
					this.pc |= 256 * this.getmem(this.wval + 1);
					this.cycles += 2;
				break;
			}
			break;
		case Sid6510.inst.jsr:
			this.cycles += 6;
			this.push((this.pc + 2) & 0xff);
			this.push((this.pc + 2) >> 8);
			this.wval = this.getmem(this.pc++);
			this.wval |= 256 * this.getmem(this.pc++);
			this.pc = this.wval;
			break;
		case Sid6510.inst.lda:
			this.a = this.getaddr(addr);
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			break;
		case Sid6510.inst.ldx:
			this.x = this.getaddr(addr);
			this.setflags(Sid6510.flag.Z, !this.x);
			this.setflags(Sid6510.flag.N, this.x & 0x80);
			break;
		case Sid6510.inst.ldy:
			this.y = this.getaddr(addr);
			this.setflags(Sid6510.flag.Z, !this.y);
			this.setflags(Sid6510.flag.N, this.y & 0x80);
			break;
		case Sid6510.inst.lsr:
			this.bval = this.getaddr(addr);
			this.wval = this.bval;
			this.wval >>= 1;
			this.setaddr(addr, this.wval & 0xff);
			this.setflags(Sid6510.flag.Z, !this.wval);
			this.setflags(Sid6510.flag.N, this.wval & 0x80);
			this.setflags(Sid6510.flag.C, this.bval & 1);
			break;
		case Sid6510.inst.nop:
			this.cycles += 2;
			break;
		case Sid6510.inst.ora:
			this.bval = this.getaddr(addr);
			this.a |= this.bval;
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			break;
		case Sid6510.inst.pha:
			this.push(this.a);
			this.cycles += 3;
			break;
		case Sid6510.inst.php:
			this.push(this.p);
			this.cycles += 3;
			break;
		case Sid6510.inst.pla:
			this.a = this.pop();
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			this.cycles += 4;
			break;
		case Sid6510.inst.plp:
			this.p = this.pop();
			this.cycles += 4;
			break;
		case Sid6510.inst.rol:
			this.bval = this.getaddr(addr);
			c = (this.p & Sid6510.flag.C) ? 1 : 0;
			this.setflags(Sid6510.flag.C, this.bval & 0x80);
			this.bval <<= 1;
			this.bval |= c;
			this.bval &= 0xff;
			this.setaddr(addr, this.bval);
			this.setflags(Sid6510.flag.N, this.bval & 0x80);
			this.setflags(Sid6510.flag.Z, !this.bval);
			break;
		case Sid6510.inst.ror:
			this.bval = this.getaddr(addr);
			c = (this.p & Sid6510.flag.C) ? 128 : 0;
			this.setflags(Sid6510.flag.C, this.bval & 1);
			this.bval >>= 1;
			this.bval |= c;
			this.setaddr(addr, this.bval);
			this.setflags(Sid6510.flag.N, this.bval & 0x80);
			this.setflags(Sid6510.flag.Z, !this.bval);
			break;
		case Sid6510.inst.rti:
			this.p = this.pop();
			this.y = this.pop();
			this.x = this.pop();
			this.a = this.pop();
			// falls through (or should!)
		case Sid6510.inst.rts:
			this.wval = 256 * this.pop();
			this.wval |= this.pop();
			this.pc = this.wval;
			this.cycles += 6;
			break;
		case Sid6510.inst.sbc:
			this.bval = this.getaddr(addr) ^ 0xff;
			this.wval = this.a + this.bval + (( this.p & Sid6510.flag.C) ? 1 : 0);
			this.setflags(Sid6510.flag.C, this.wval & 0x100);
			this.a = this.wval & 0xff;
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a > 127);
			this.setflags(Sid6510.flag.V, ((this.p & Sid6510.flag.C) ? 1 : 0) ^ ((this.p & Sid6510.flag.N) ? 1 : 0));
			break;
		case Sid6510.inst.sec:
			this.cycles += 2;
			this.setflags(Sid6510.flag.C, 1);
			break;
		case Sid6510.inst.sed:
			this.cycles += 2;
			this.setflags(Sid6510.flag.D, 1);
			break;
		case Sid6510.inst.sei:
			this.cycles += 2;
			this.setflags(Sid6510.flag.I, 1);
			break;
		case Sid6510.inst.sta:
			this.putaddr(addr, this.a);
			break;
		case Sid6510.inst.stx:
			this.putaddr(addr, this.x);
			break;
		case Sid6510.inst.sty:
			this.putaddr(addr, this.y);
			break;
		case Sid6510.inst.tax:
			this.cycles += 2;
			this.x = this.a;
			this.setflags(Sid6510.flag.Z, !this.x);
			this.setflags(Sid6510.flag.N, this.x & 0x80);
			break;
		case Sid6510.inst.tay:
			this.cycles += 2;
			this.y = this.a;
			this.setflags(Sid6510.flag.Z, !this.y);
			this.setflags(Sid6510.flag.N, this.y & 0x80);
			break;
		case Sid6510.inst.tsx:
			this.cycles += 2;
			this.x = this.s;
			this.setflags(Sid6510.flag.Z, !this.x);
			this.setflags(Sid6510.flag.N, this.x & 0x80);
			break;
		case Sid6510.inst.txa:
			this.cycles += 2;
			this.a = this.x;
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			break;
		case Sid6510.inst.txs:
			this.cycles += 2;
			this.s = this.x;
			break;
		case Sid6510.inst.tya:
			this.cycles += 2;
			this.a = this.y;
			this.setflags(Sid6510.flag.Z, !this.a);
			this.setflags(Sid6510.flag.N, this.a & 0x80);
			break;
	}
	return this.cycles;

};

Sid6510.prototype.cpuJSR = function(npc, na) {
	var ccl = 0;

	this.a = na;
	this.x = 0;
	this.y = 0;
	this.p = 0;
	this.s = 255;
	this.pc = npc;
	this.push(0);
	this.push(0);

	while (this.pc) {
		ccl += this.cpuParse();
	}
	return ccl;
};

//Sid6510.SOMEPROP = const type val;

// Flags Enum
Sid6510.flag = Object.freeze ({
	N: 128, V: 64, B: 16, D: 8, I: 4, Z: 2, C: 1
});


// Opcodes Enum
Sid6510.inst = Object.freeze ({
  adc: {}, and: {}, asl: {}, bcc: {}, bcs: {}, beq: {}, bit: {}, bmi: {}, bne: {}, bpl: {}, brk: {}, bvc: {}, bvs: {}, clc: {},
  cld: {}, cli: {}, clv: {}, cmp: {}, cpx: {}, cpy: {}, dec: {}, dex: {}, dey: {}, eor: {}, inc: {}, inx: {}, iny: {}, jmp: {},
  jsr: {}, lda: {}, ldx: {}, ldy: {}, lsr: {}, nop: {}, ora: {}, pha: {}, php: {}, pla: {}, plp: {}, rol: {}, ror: {}, rti: {},
  rts: {}, sbc: {}, sec: {}, sed: {}, sei: {}, sta: {}, stx: {}, sty: {}, tax: {}, tay: {}, tsx: {}, txa: {}, txs: {}, tya: {},
  xxx: {}
});

// Modes Enum
Sid6510.mode = Object.freeze ({
   imp: {}, imm: {}, abs: {}, absx: {}, absy: {}, zp: {}, zpx: {}, zpy: {}, ind: {}, indx: {}, indy: {}, acc: {}, rel: {}, xxx: {}
});


// 256 entries, each entry array pair of [inst, mode]
Sid6510.opcodes = new Array(
	[Sid6510.inst.brk, Sid6510.mode.imp],							// 0x00
	[Sid6510.inst.ora, Sid6510.mode.indx],							// 0x01
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x02
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x03
	[Sid6510.inst.xxx, Sid6510.mode.zp],							// 0x04
	[Sid6510.inst.ora, Sid6510.mode.zp],							// 0x05
	[Sid6510.inst.asl, Sid6510.mode.zp],							// 0x06
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x07
	[Sid6510.inst.php, Sid6510.mode.imp],							// 0x08
	[Sid6510.inst.ora, Sid6510.mode.imm],							// 0x09
	[Sid6510.inst.asl, Sid6510.mode.acc],							// 0x0a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x0b
	[Sid6510.inst.xxx, Sid6510.mode.abs],							// 0x0c
	[Sid6510.inst.ora, Sid6510.mode.abs],							// 0x0d
	[Sid6510.inst.asl, Sid6510.mode.abs],							// 0x0e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x0f

	[Sid6510.inst.bpl, Sid6510.mode.rel],							// 0x10
	[Sid6510.inst.ora, Sid6510.mode.indy],							// 0x11
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x12
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x13
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x14
	[Sid6510.inst.ora, Sid6510.mode.zpx],							// 0x15
	[Sid6510.inst.asl, Sid6510.mode.zpx],							// 0x16
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x17
	[Sid6510.inst.clc, Sid6510.mode.imp],							// 0x18
	[Sid6510.inst.ora, Sid6510.mode.absy],							// 0x19
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x1a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x1b
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x1c
	[Sid6510.inst.ora, Sid6510.mode.absx],							// 0x1d
	[Sid6510.inst.asl, Sid6510.mode.absx],							// 0x1e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x1f

	[Sid6510.inst.jsr, Sid6510.mode.abs],							// 0x20
	[Sid6510.inst.and, Sid6510.mode.indx],							// 0x21
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x22
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x23
	[Sid6510.inst.bit, Sid6510.mode.zp],							// 0x24
	[Sid6510.inst.and, Sid6510.mode.zp],							// 0x25
	[Sid6510.inst.rol, Sid6510.mode.zp],							// 0x26
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x27
	[Sid6510.inst.plp, Sid6510.mode.imp],							// 0x28
	[Sid6510.inst.and, Sid6510.mode.imm],							// 0x29
	[Sid6510.inst.rol, Sid6510.mode.acc],							// 0x2a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x2b
	[Sid6510.inst.bit, Sid6510.mode.abs],							// 0x2c
	[Sid6510.inst.and, Sid6510.mode.abs],							// 0x2d
	[Sid6510.inst.rol, Sid6510.mode.abs],							// 0x2e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x2f

	[Sid6510.inst.bmi, Sid6510.mode.rel],							// 0x30
	[Sid6510.inst.and, Sid6510.mode.indy],							// 0x31
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x32
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x33
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x34
	[Sid6510.inst.and, Sid6510.mode.zpx],							// 0x35
	[Sid6510.inst.rol, Sid6510.mode.zpx],							// 0x36
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x37
	[Sid6510.inst.sec, Sid6510.mode.imp],							// 0x38
	[Sid6510.inst.and, Sid6510.mode.absy],							// 0x39
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x3a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x3b
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x3c
	[Sid6510.inst.and, Sid6510.mode.absx],							// 0x3d
	[Sid6510.inst.rol, Sid6510.mode.absx],							// 0x3e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x3f

	[Sid6510.inst.rti, Sid6510.mode.imp],							// 0x40
	[Sid6510.inst.eor, Sid6510.mode.indx],							// 0x41
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x42
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x43
	[Sid6510.inst.xxx, Sid6510.mode.zp],							// 0x44
	[Sid6510.inst.eor, Sid6510.mode.zp],							// 0x45
	[Sid6510.inst.lsr, Sid6510.mode.zp],							// 0x46
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x47
	[Sid6510.inst.pha, Sid6510.mode.imp],							// 0x48
	[Sid6510.inst.eor, Sid6510.mode.imm],							// 0x49
	[Sid6510.inst.lsr, Sid6510.mode.acc],							// 0x4a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x4b
	[Sid6510.inst.jmp, Sid6510.mode.abs],							// 0x4c
	[Sid6510.inst.eor, Sid6510.mode.abs],							// 0x4d
	[Sid6510.inst.lsr, Sid6510.mode.abs],							// 0x4e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x4f

	[Sid6510.inst.bvc, Sid6510.mode.rel],							// 0x50
	[Sid6510.inst.eor, Sid6510.mode.indy],							// 0x51
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x52
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x53
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x54
	[Sid6510.inst.eor, Sid6510.mode.zpx],							// 0x55
	[Sid6510.inst.lsr, Sid6510.mode.zpx],							// 0x56
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x57
	[Sid6510.inst.cli, Sid6510.mode.imp],							// 0x58
	[Sid6510.inst.eor, Sid6510.mode.absy],							// 0x59
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x5a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x5b
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x5c
	[Sid6510.inst.eor, Sid6510.mode.absx],							// 0x5d
	[Sid6510.inst.lsr, Sid6510.mode.absx],							// 0x5e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x5f

	[Sid6510.inst.rts, Sid6510.mode.imp],							// 0x60
	[Sid6510.inst.adc, Sid6510.mode.indx],							// 0x61
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x62
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x63
	[Sid6510.inst.xxx, Sid6510.mode.zp],							// 0x64
	[Sid6510.inst.adc, Sid6510.mode.zp],							// 0x65
	[Sid6510.inst.ror, Sid6510.mode.zp],							// 0x66
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x67
	[Sid6510.inst.pla, Sid6510.mode.imp],							// 0x68
	[Sid6510.inst.adc, Sid6510.mode.imm],							// 0x69
	[Sid6510.inst.ror, Sid6510.mode.acc],							// 0x6a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x6b
	[Sid6510.inst.jmp, Sid6510.mode.ind],							// 0x6c
	[Sid6510.inst.adc, Sid6510.mode.abs],							// 0x6d
	[Sid6510.inst.ror, Sid6510.mode.abs],							// 0x6e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x6f

	[Sid6510.inst.bvs, Sid6510.mode.rel],							// 0x70
	[Sid6510.inst.adc, Sid6510.mode.indy],							// 0x71
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x72
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x73
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x74
	[Sid6510.inst.adc, Sid6510.mode.zpx],							// 0x75
	[Sid6510.inst.ror, Sid6510.mode.zpx],							// 0x76
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x77
	[Sid6510.inst.sei, Sid6510.mode.imp],							// 0x78
	[Sid6510.inst.adc, Sid6510.mode.absy],							// 0x79
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x7a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x7b
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x7c
	[Sid6510.inst.adc, Sid6510.mode.absx],							// 0x7d
	[Sid6510.inst.ror, Sid6510.mode.absx],							// 0x7e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x7f

	[Sid6510.inst.xxx, Sid6510.mode.imm],							// 0x80
	[Sid6510.inst.sta, Sid6510.mode.indx],							// 0x81
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x82
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x83
	[Sid6510.inst.sty, Sid6510.mode.zp],							// 0x84
	[Sid6510.inst.sta, Sid6510.mode.zp],							// 0x85
	[Sid6510.inst.stx, Sid6510.mode.zp],							// 0x86
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x87
	[Sid6510.inst.dey, Sid6510.mode.imp],							// 0x88
	[Sid6510.inst.xxx, Sid6510.mode.imm],							// 0x89
	[Sid6510.inst.txa, Sid6510.mode.acc],							// 0x8a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x8b
	[Sid6510.inst.sty, Sid6510.mode.abs],							// 0x8c
	[Sid6510.inst.sta, Sid6510.mode.abs],							// 0x8d
	[Sid6510.inst.stx, Sid6510.mode.abs],							// 0x8e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x8f

	[Sid6510.inst.bcc, Sid6510.mode.rel],							// 0x90
	[Sid6510.inst.sta, Sid6510.mode.indy],							// 0x91
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x92
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x93
	[Sid6510.inst.sty, Sid6510.mode.zpx],							// 0x94
	[Sid6510.inst.sta, Sid6510.mode.zpx],							// 0x95
	[Sid6510.inst.stx, Sid6510.mode.zpy],							// 0x96
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x97
	[Sid6510.inst.tya, Sid6510.mode.imp],							// 0x98
	[Sid6510.inst.sta, Sid6510.mode.absy],							// 0x99
	[Sid6510.inst.txs, Sid6510.mode.acc],							// 0x9a
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x9b
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x9c
	[Sid6510.inst.sta, Sid6510.mode.absx],							// 0x9d
	[Sid6510.inst.xxx, Sid6510.mode.absx],							// 0x9e
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0x9f

	[Sid6510.inst.ldy, Sid6510.mode.imm],							// 0xa0
	[Sid6510.inst.lda, Sid6510.mode.indx],							// 0xa1
	[Sid6510.inst.ldx, Sid6510.mode.imm],							// 0xa2
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xa3
	[Sid6510.inst.ldy, Sid6510.mode.zp],							// 0xa4
	[Sid6510.inst.lda, Sid6510.mode.zp],							// 0xa5
	[Sid6510.inst.ldx, Sid6510.mode.zp],							// 0xa6
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xa7
	[Sid6510.inst.tay, Sid6510.mode.imp],							// 0xa8
	[Sid6510.inst.lda, Sid6510.mode.imm],							// 0xa9
	[Sid6510.inst.tax, Sid6510.mode.acc],							// 0xaa
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xab
	[Sid6510.inst.ldy, Sid6510.mode.abs],							// 0xac
	[Sid6510.inst.lda, Sid6510.mode.abs],							// 0xad
	[Sid6510.inst.ldx, Sid6510.mode.abs],							// 0xae
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xaf

	[Sid6510.inst.bcs, Sid6510.mode.rel],							// 0xb0
	[Sid6510.inst.lda, Sid6510.mode.indy],							// 0xb1
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xb2
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xb3
	[Sid6510.inst.ldy, Sid6510.mode.zpx],							// 0xb4
	[Sid6510.inst.lda, Sid6510.mode.zpx],							// 0xb5
	[Sid6510.inst.ldx, Sid6510.mode.zpy],							// 0xb6
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xb7
	[Sid6510.inst.clv, Sid6510.mode.imp],							// 0xb8
	[Sid6510.inst.lda, Sid6510.mode.absy],							// 0xb9
	[Sid6510.inst.tsx, Sid6510.mode.acc],							// 0xba
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xbb
	[Sid6510.inst.ldy, Sid6510.mode.absx],							// 0xbc
	[Sid6510.inst.lda, Sid6510.mode.absx],							// 0xbd
	[Sid6510.inst.ldx, Sid6510.mode.absy],							// 0xbe
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xbf

	[Sid6510.inst.cpy, Sid6510.mode.imm],							// 0xc0
	[Sid6510.inst.cmp, Sid6510.mode.indx],							// 0xc1
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xc2
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xc3
	[Sid6510.inst.cpy, Sid6510.mode.zp],							// 0xc4
	[Sid6510.inst.cmp, Sid6510.mode.zp],							// 0xc5
	[Sid6510.inst.dec, Sid6510.mode.zp],							// 0xc6
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xc7
	[Sid6510.inst.iny, Sid6510.mode.imp],							// 0xc8
	[Sid6510.inst.cmp, Sid6510.mode.imm],							// 0xc9
	[Sid6510.inst.dex, Sid6510.mode.acc],							// 0xca
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xcb
	[Sid6510.inst.cpy, Sid6510.mode.abs],							// 0xcc
	[Sid6510.inst.cmp, Sid6510.mode.abs],							// 0xcd
	[Sid6510.inst.dec, Sid6510.mode.abs],							// 0xce
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xcf

	[Sid6510.inst.bne, Sid6510.mode.rel],							// 0xd0
	[Sid6510.inst.cmp, Sid6510.mode.indy],							// 0xd1
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xd2
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xd3
	[Sid6510.inst.xxx, Sid6510.mode.zpx],							// 0xd4
	[Sid6510.inst.cmp, Sid6510.mode.zpx],							// 0xd5
	[Sid6510.inst.dec, Sid6510.mode.zpx],							// 0xd6
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xd7
	[Sid6510.inst.cld, Sid6510.mode.imp],							// 0xd8
	[Sid6510.inst.cmp, Sid6510.mode.absy],							// 0xd9
	[Sid6510.inst.xxx, Sid6510.mode.acc],							// 0xda
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xdb
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xdc
	[Sid6510.inst.cmp, Sid6510.mode.absx],							// 0xdd
	[Sid6510.inst.dec, Sid6510.mode.absx],							// 0xde
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xdf

	[Sid6510.inst.cpx, Sid6510.mode.imm],							// 0xe0
	[Sid6510.inst.sbc, Sid6510.mode.indx],							// 0xe1
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xe2
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xe3
	[Sid6510.inst.cpx, Sid6510.mode.zp],							// 0xe4
	[Sid6510.inst.sbc, Sid6510.mode.zp],							// 0xe5
	[Sid6510.inst.inc, Sid6510.mode.zp],							// 0xe6
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xe7
	[Sid6510.inst.inx, Sid6510.mode.imp],							// 0xe8
	[Sid6510.inst.sbc, Sid6510.mode.imm],							// 0xe9
	[Sid6510.inst.nop, Sid6510.mode.acc],							// 0xea
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xeb
	[Sid6510.inst.cpx, Sid6510.mode.abs],							// 0xec
	[Sid6510.inst.sbc, Sid6510.mode.abs],							// 0xed
	[Sid6510.inst.inc, Sid6510.mode.abs],							// 0xee
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xef

	[Sid6510.inst.beq, Sid6510.mode.rel],							// 0xf0
	[Sid6510.inst.sbc, Sid6510.mode.indy],							// 0xf1
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xf2
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xf3
	[Sid6510.inst.xxx, Sid6510.mode.zpx],							// 0xf4
	[Sid6510.inst.sbc, Sid6510.mode.zpx],							// 0xf5
	[Sid6510.inst.inc, Sid6510.mode.zpx],							// 0xf6
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xf7
	[Sid6510.inst.sed, Sid6510.mode.imp],							// 0xf8
	[Sid6510.inst.sbc, Sid6510.mode.absy],							// 0xf9
	[Sid6510.inst.xxx, Sid6510.mode.acc],							// 0xfa
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xfb
	[Sid6510.inst.xxx, Sid6510.mode.xxx],							// 0xfc
	[Sid6510.inst.sbc, Sid6510.mode.absx],							// 0xfd
	[Sid6510.inst.inc, Sid6510.mode.absx],							// 0xfe
	[Sid6510.inst.xxx, Sid6510.mode.xxx]							// 0xff
);


