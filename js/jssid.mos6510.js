
jsSID.MOS6510 = function(mem, sid) {

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

jsSID.MOS6510.prototype.getmem = function(addr) {
	//if (addr < 0 || addr > 65536) console.log("jsSID.MOS6510.getmem: out of range addr: " + addr + " (caller: " + arguments.caller + ")");
	//if (addr == 0xdd0d) {
	//	this.mem[addr] = 0;
	//}
	return this.mem[addr];
};

jsSID.MOS6510.prototype.setmem = function(addr, value) {
	//if (addr < 0 || addr > 65535) console.log("jsSID.MOS6510.getmem: out of range addr: " + addr + " (caller: " + arguments.caller + ")");
	//if (value < 0 || value > 255 ) console.log("jsSID.MOS6510.getmem: out of range value: " + value + " (caller: " + arguments.caller + ")");
	if ((addr & 0xfc00) == 0xd400 && this.sid !== null) {
		this.sid.poke(addr & 0x1f, value);
		if (addr > 0xd418) {
			console.log("attempted digi poke:", addr, value);
			this.sid.pokeDigi(addr, value);
		}
	} else {
		this.mem[addr] = value;
	}

};

// just like pc++, but with bound check on pc after
jsSID.MOS6510.prototype.pcinc = function(mode) {
	var pc = this.pc++;
	this.pc &= 0xffff;
	return pc;
};

jsSID.MOS6510.prototype.getaddr = function(mode) {

	var ad,ad2;
	switch(mode) {
		case jsSID.MOS6510.mode.imp:
			this.cycles += 2;
			return 0;
		case jsSID.MOS6510.mode.imm:
			this.cycles += 2;
			return this.getmem(this.pcinc());
		case jsSID.MOS6510.mode.abs:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad |= this.getmem(this.pcinc()) << 8;
			return this.getmem(ad);
		case jsSID.MOS6510.mode.absx:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad |= 256 * this.getmem(this.pcinc());
			ad2 = ad + this.x;
			ad2 &= 0xffff;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			return this.getmem(ad2);
		case jsSID.MOS6510.mode.absy:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad |= 256 * this.getmem(this.pcinc());
			ad2 = ad + this.y;
			ad2 &= 0xffff;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			return this.getmem(ad2);
		case jsSID.MOS6510.mode.zp:
			this.cycles += 3;
			ad = this.getmem(this.pcinc());
			return this.getmem(ad);
		case jsSID.MOS6510.mode.zpx:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad += this.x;
			return this.getmem(ad & 0xff);
		case jsSID.MOS6510.mode.zpy:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad += this.y;
			return this.getmem(ad & 0xff);
		case jsSID.MOS6510.mode.indx:
			this.cycles += 6;
			ad = this.getmem(this.pcinc());
			ad += this.x;
			ad2 = this.getmem(ad & 0xff);
			ad++;
			ad2 |= this.getmem(ad & 0xff) << 8;
			return this.getmem(ad2);
		case jsSID.MOS6510.mode.indy:
			this.cycles += 5;
			ad = this.getmem(this.pcinc());
			ad2 = this.getmem(ad);
			ad2 |= this.getmem((ad + 1) & 0xff) << 8;
			ad = ad2 + this.y;
			ad &= 0xffff;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			return this.getmem(ad);
		case jsSID.MOS6510.mode.acc:
			this.cycles += 2;
			return this.a;
	}
	console.log("getaddr: attempted unhandled mode");
	return 0;

};

jsSID.MOS6510.prototype.setaddr = function(mode, val) {
	var ad,ad2;
	// FIXME: not checking pc addresses as all should be relative to a valid instruction
	switch(mode) {
		case jsSID.MOS6510.mode.abs:
			this.cycles += 2;
			ad = this.getmem(this.pc - 2);
			ad |= 256 * this.getmem(this.pc - 1);
			this.setmem(ad, val);
			return;
		case jsSID.MOS6510.mode.absx:
			this.cycles += 3;
			ad = this.getmem(this.pc - 2);
			ad |= 256 * this.getmem(this.pc - 1);
			ad2 = ad + this.x;
			ad2 &= 0xffff;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles--;
			this.setmem(ad2, val);
			return;
		case jsSID.MOS6510.mode.zp:
			this.cycles += 2;
			ad = this.getmem(this.pc - 1);
			this.setmem(ad, val);
			return;
		case jsSID.MOS6510.mode.zpx:
			this.cycles += 2;
			ad = this.getmem(this.pc - 1);
			ad += this.x;
			this.setmem(ad & 0xff, val);
			return;
		case jsSID.MOS6510.mode.acc:
			this.a = val;
			return;
	}
	console.log("setaddr: attempted unhandled mode");
};

jsSID.MOS6510.prototype.putaddr = function(mode, val) {
	var ad,ad2;
	switch(mode) {
		case jsSID.MOS6510.mode.abs:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad |= this.getmem(this.pcinc()) << 8;
			this.setmem(ad, val);
			return;
		case jsSID.MOS6510.mode.absx:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad |= this.getmem(this.pcinc()) << 8;
			ad2 = ad + this.x;
			ad2 &= 0xffff;
			this.setmem(ad2, val);
			return;
		case jsSID.MOS6510.mode.absy:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad |= this.getmem(this.pcinc()) << 8;
			ad2 = ad + this.y;
			ad2 &= 0xffff;
			if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
			this.setmem(ad2, val);
			return;
		case jsSID.MOS6510.mode.zp:
			this.cycles += 3;
			ad = this.getmem(this.pcinc());
			this.setmem(ad, val);
			return;
		case jsSID.MOS6510.mode.zpx:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad += this.x;
			this.setmem(ad & 0xff, val);
			return;
		case jsSID.MOS6510.mode.zpy:
			this.cycles += 4;
			ad = this.getmem(this.pcinc());
			ad += this.y;
			this.setmem(ad & 0xff,val);
			return;
		case jsSID.MOS6510.mode.indx:
			this.cycles += 6;
			ad = this.getmem(this.pcinc());
			ad += this.x;
			ad2 = this.getmem(ad & 0xff);
			ad++;
			ad2 |= this.getmem(ad & 0xff) << 8;
			this.setmem(ad2, val);
			return;
		case jsSID.MOS6510.mode.indy:
			this.cycles += 5;
			ad = this.getmem(this.pcinc());
			ad2 = this.getmem(ad);
			ad2 |= this.getmem((ad + 1) & 0xff) << 8;
			ad = ad2 + this.y;
			ad &= 0xffff;
			this.setmem(ad, val);
			return;
		case jsSID.MOS6510.mode.acc:
			this.cycles += 2;
			this.a = val;
			return;
	}
	console.log("putaddr: attempted unhandled mode");
};

jsSID.MOS6510.prototype.setflags = function(flag, cond) {
	if (cond) {
		this.p |= flag;
	} else {
		this.p &= ~flag & 0xff;
	}
};

jsSID.MOS6510.prototype.push = function(val) {
	this.setmem(0x100 + this.s, val);
	if (this.s) this.s--;
};

jsSID.MOS6510.prototype.pop = function() {
	if (this.s < 0xff) this.s++;
	return this.getmem(0x100 + this.s);
};

jsSID.MOS6510.prototype.branch = function(flag) {
	var dist = this.getaddr(jsSID.MOS6510.mode.imm);
	// FIXME: while this was checked out, it still seems too complicated
	// make signed
	if (dist & 0x80) {
		dist = 0 - ((~dist & 0xff) + 1);
	}

	// this here needs to be extracted for general 16-bit rounding needs
	this.wval= this.pc + dist;
	// FIXME: added boundary checks to wrap around. Not sure this is whats needed
	if (this.wval < 0) this.wval += 65536;
	this.wval &= 0xffff;
	if (flag) {
		this.cycles += ((this.pc & 0x100) != (this.wval & 0x100)) ? 2 : 1;
		this.pc = this.wval;
	}
};

jsSID.MOS6510.prototype.cpuReset = function() {
	this.a	= 0;
	this.x	= 0;
	this.y	= 0;
	this.p	= 0;
	this.s	= 255;
	this.pc	= this.getmem(0xfffc);
	this.pc |= 256 * this.getmem(0xfffd);
};

jsSID.MOS6510.prototype.cpuResetTo = function(npc, na) {
	this.a	= na || 0;
	this.x	= 0;
	this.y	= 0;
	this.p	= 0;
	this.s	= 255;
	this.pc	= npc;
};

jsSID.MOS6510.prototype.cpuParse = function() {
	var c;
	this.cycles = 0;

	var opc = this.getmem(this.pcinc());
	var cmd = jsSID.MOS6510.opcodes[opc][0];
	var addr = jsSID.MOS6510.opcodes[opc][1];

	//console.log(opc, cmd, addr);

	switch (cmd) {
		case jsSID.MOS6510.inst.adc:
			this.wval = this.a + this.getaddr(addr) + ((this.p & jsSID.MOS6510.flag.C) ? 1 : 0);
			this.setflags(jsSID.MOS6510.flag.C, this.wval & 0x100);
			this.a = this.wval & 0xff;
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			this.setflags(jsSID.MOS6510.flag.V, ((this.p & jsSID.MOS6510.flag.C) ? 1 : 0) ^ ((this.p & jsSID.MOS6510.flag.N) ? 1 : 0));
			break;
		case jsSID.MOS6510.inst.and:
			this.bval = this.getaddr(addr);
			this.a &= this.bval;
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			break;
		case jsSID.MOS6510.inst.asl:
			this.wval = this.getaddr(addr);
			this.wval <<= 1;
			this.setaddr(addr, this.wval & 0xff);
			this.setflags(jsSID.MOS6510.flag.Z, !this.wval);
			this.setflags(jsSID.MOS6510.flag.N, this.wval & 0x80);
			this.setflags(jsSID.MOS6510.flag.C, this.wval & 0x100);
			break;
		case jsSID.MOS6510.inst.bcc:
			this.branch(!(this.p & jsSID.MOS6510.flag.C));
			break;
		case jsSID.MOS6510.inst.bcs:
			this.branch(this.p & jsSID.MOS6510.flag.C);
			break;
		case jsSID.MOS6510.inst.bne:
			this.branch(!(this.p & jsSID.MOS6510.flag.Z));
			break;
		case jsSID.MOS6510.inst.beq:
			this.branch(this.p & jsSID.MOS6510.flag.Z);
			break;
		case jsSID.MOS6510.inst.bpl:
			this.branch(!(this.p & jsSID.MOS6510.flag.N));
			break;
		case jsSID.MOS6510.inst.bmi:
			this.branch(this.p & jsSID.MOS6510.flag.N);
			break;
		case jsSID.MOS6510.inst.bvc:
			this.branch(!(this.p & jsSID.MOS6510.flag.V));
			break;
		case jsSID.MOS6510.inst.bvs:
			this.branch(this.p & jsSID.MOS6510.flag.V);
			break;
		case jsSID.MOS6510.inst.bit:
			this.bval = this.getaddr(addr);
			this.setflags(jsSID.MOS6510.flag.Z, !(this.a & this.bval));
			this.setflags(jsSID.MOS6510.flag.N, this.bval & 0x80);
			this.setflags(jsSID.MOS6510.flag.V, this.bval & 0x40);
			break;
		case jsSID.MOS6510.inst.brk:
			pc=0;	// just quit per rockbox
			//this.push(this.pc & 0xff);
			//this.push(this.pc >> 8);
			//this.push(this.p);
			//this.setflags(jsSID.MOS6510.flag.B, 1);
			// FIXME: should Z be set as well?
			//this.pc = this.getmem(0xfffe);
			//this.cycles += 7;
			break;
		case jsSID.MOS6510.inst.clc:
			this.cycles += 2;
			this.setflags(jsSID.MOS6510.flag.C, 0);
			break;
		case jsSID.MOS6510.inst.cld:
			this.cycles += 2;
			this.setflags(jsSID.MOS6510.flag.D, 0);
			break;
		case jsSID.MOS6510.inst.cli:
			this.cycles += 2;
			this.setflags(jsSID.MOS6510.flag.I, 0);
			break;
		case jsSID.MOS6510.inst.clv:
			this.cycles += 2;
			this.setflags(jsSID.MOS6510.flag.V, 0);
			break;
		case jsSID.MOS6510.inst.cmp:
			this.bval = this.getaddr(addr);
			this.wval = this.a - this.bval;
			// FIXME: may not actually be needed (yay 2's complement)
			if(this.wval < 0) this.wval += 256;
			this.setflags(jsSID.MOS6510.flag.Z, !this.wval);
			this.setflags(jsSID.MOS6510.flag.N, this.wval & 0x80);
			this.setflags(jsSID.MOS6510.flag.C, this.a >= this.bval);
			break;
		case jsSID.MOS6510.inst.cpx:
			this.bval = this.getaddr(addr);
			this.wval = this.x - this.bval;
			// FIXME: may not actually be needed (yay 2's complement)
			if(this.wval < 0) this.wval += 256;
			this.setflags(jsSID.MOS6510.flag.Z, !this.wval);
			this.setflags(jsSID.MOS6510.flag.N, this.wval & 0x80);
			this.setflags(jsSID.MOS6510.flag.C, this.x >= this.bval);
			break;
		case jsSID.MOS6510.inst.cpy:
			this.bval = this.getaddr(addr);
			this.wval = this.y - this.bval;
			// FIXME: may not actually be needed (yay 2's complement)
			if(this.wval < 0) this.wval += 256;
			this.setflags(jsSID.MOS6510.flag.Z, !this.wval);
			this.setflags(jsSID.MOS6510.flag.N, this.wval & 0x80);
			this.setflags(jsSID.MOS6510.flag.C, this.y >= this.bval);
			break;
		case jsSID.MOS6510.inst.dec:
			this.bval = this.getaddr(addr);
			this.bval--;
			// FIXME: may be able to just mask this (yay 2's complement)
			if(this.bval < 0) this.bval += 256;
			this.setaddr(addr, this.bval);
			this.setflags(jsSID.MOS6510.flag.Z, !this.bval);
			this.setflags(jsSID.MOS6510.flag.N, this.bval & 0x80);
			break;
		case jsSID.MOS6510.inst.dex:
			this.cycles += 2;
			this.x--;
			// FIXME: may be able to just mask this (yay 2's complement)
			if(this.x < 0) this.x += 256;
			this.setflags(jsSID.MOS6510.flag.Z, !this.x);
			this.setflags(jsSID.MOS6510.flag.N, this.x & 0x80);
			break;
		case jsSID.MOS6510.inst.dey:
			this.cycles += 2;
			this.y--;
			// FIXME: may be able to just mask this (yay 2's complement)
			if(this.y < 0) this.y += 256;
			this.setflags(jsSID.MOS6510.flag.Z, !this.y);
			this.setflags(jsSID.MOS6510.flag.N, this.y & 0x80);
			break;
		case jsSID.MOS6510.inst.eor:
			this.bval = this.getaddr(addr);
			this.a ^= this.bval;
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			break;
		case jsSID.MOS6510.inst.inc:
			this.bval = this.getaddr(addr);
			this.bval++;
			this.bval &= 0xff;
			this.setaddr(addr, this.bval);
			this.setflags(jsSID.MOS6510.flag.Z, !this.bval);
			this.setflags(jsSID.MOS6510.flag.N, this.bval & 0x80);
			break;
		case jsSID.MOS6510.inst.inx:
			this.cycles += 2;
			this.x++;
			this.x &= 0xff;
			this.setflags(jsSID.MOS6510.flag.Z, !this.x);
			this.setflags(jsSID.MOS6510.flag.N, this.x & 0x80);
			break;
		case jsSID.MOS6510.inst.iny:
			this.cycles += 2;
			this.y++;
			this.y &= 0xff;
			this.setflags(jsSID.MOS6510.flag.Z, !this.y);
			this.setflags(jsSID.MOS6510.flag.N, this.y & 0x80);
			break;
		case jsSID.MOS6510.inst.jmp:
			this.cycles += 3;
			this.wval = this.getmem(this.pcinc());
			this.wval |= 256 * this.getmem(this.pcinc());
			switch (addr) {
				case jsSID.MOS6510.mode.abs:
					this.pc = this.wval;
					break;
				case jsSID.MOS6510.mode.ind:
					this.pc = this.getmem(this.wval);
					this.pc |= 256 * this.getmem((this.wval + 1) & 0xffff);
					this.cycles += 2;
					break;
			}
			break;
		case jsSID.MOS6510.inst.jsr:
			this.cycles += 6;
			this.push(((this.pc + 1) & 0xffff) >> 8);
			this.push((this.pc + 1) & 0xff);
			this.wval = this.getmem(this.pcinc());
			this.wval |= 256 * this.getmem(this.pcinc());
			this.pc = this.wval;
			break;
		case jsSID.MOS6510.inst.lda:
			this.a = this.getaddr(addr);
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			break;
		case jsSID.MOS6510.inst.ldx:
			this.x = this.getaddr(addr);
			this.setflags(jsSID.MOS6510.flag.Z, !this.x);
			this.setflags(jsSID.MOS6510.flag.N, this.x & 0x80);
			break;
		case jsSID.MOS6510.inst.ldy:
			this.y = this.getaddr(addr);
			this.setflags(jsSID.MOS6510.flag.Z, !this.y);
			this.setflags(jsSID.MOS6510.flag.N, this.y & 0x80);
			break;
		case jsSID.MOS6510.inst.lsr:
			this.bval = this.getaddr(addr);
			this.wval = this.bval;
			this.wval >>= 1;
			this.setaddr(addr, this.wval & 0xff);
			this.setflags(jsSID.MOS6510.flag.Z, !this.wval);
			this.setflags(jsSID.MOS6510.flag.N, this.wval & 0x80);
			this.setflags(jsSID.MOS6510.flag.C, this.bval & 1);
			break;
		case jsSID.MOS6510.inst.nop:
			this.cycles += 2;
			break;
		case jsSID.MOS6510.inst.ora:
			this.bval = this.getaddr(addr);
			this.a |= this.bval;
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			break;
		case jsSID.MOS6510.inst.pha:
			this.push(this.a);
			this.cycles += 3;
			break;
		case jsSID.MOS6510.inst.php:
			this.push(this.p);
			this.cycles += 3;
			break;
		case jsSID.MOS6510.inst.pla:
			this.a = this.pop();
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			this.cycles += 4;
			break;
		case jsSID.MOS6510.inst.plp:
			this.p = this.pop();
			this.cycles += 4;
			break;
		case jsSID.MOS6510.inst.rol:
			this.bval = this.getaddr(addr);
			c = (this.p & jsSID.MOS6510.flag.C) ? 1 : 0;
			this.setflags(jsSID.MOS6510.flag.C, this.bval & 0x80);
			this.bval <<= 1;
			this.bval |= c;
			this.bval &= 0xff;
			this.setaddr(addr, this.bval);
			this.setflags(jsSID.MOS6510.flag.N, this.bval & 0x80);
			this.setflags(jsSID.MOS6510.flag.Z, !this.bval);
			break;
		case jsSID.MOS6510.inst.ror:
			this.bval = this.getaddr(addr);
			c = (this.p & jsSID.MOS6510.flag.C) ? 128 : 0;
			this.setflags(jsSID.MOS6510.flag.C, this.bval & 1);
			this.bval >>= 1;
			this.bval |= c;
			this.setaddr(addr, this.bval);
			this.setflags(jsSID.MOS6510.flag.N, this.bval & 0x80);
			this.setflags(jsSID.MOS6510.flag.Z, !this.bval);
			break;
		case jsSID.MOS6510.inst.rti:
			// treat like RTS
		case jsSID.MOS6510.inst.rts:
			this.wval = this.pop();
			this.wval |= 256 * this.pop();
			this.pc = this.wval + 1;
			this.cycles += 6;
			break;
		case jsSID.MOS6510.inst.sbc:
			this.bval = this.getaddr(addr) ^ 0xff;
			this.wval = this.a + this.bval + (( this.p & jsSID.MOS6510.flag.C) ? 1 : 0);
			this.setflags(jsSID.MOS6510.flag.C, this.wval & 0x100);
			this.a = this.wval & 0xff;
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a > 127);
			this.setflags(jsSID.MOS6510.flag.V, ((this.p & jsSID.MOS6510.flag.C) ? 1 : 0) ^ ((this.p & jsSID.MOS6510.flag.N) ? 1 : 0));
			break;
		case jsSID.MOS6510.inst.sec:
			this.cycles += 2;
			this.setflags(jsSID.MOS6510.flag.C, 1);
			break;
		case jsSID.MOS6510.inst.sed:
			this.cycles += 2;
			this.setflags(jsSID.MOS6510.flag.D, 1);
			break;
		case jsSID.MOS6510.inst.sei:
			this.cycles += 2;
			this.setflags(jsSID.MOS6510.flag.I, 1);
			break;
		case jsSID.MOS6510.inst.sta:
			this.putaddr(addr, this.a);
			break;
		case jsSID.MOS6510.inst.stx:
			this.putaddr(addr, this.x);
			break;
		case jsSID.MOS6510.inst.sty:
			this.putaddr(addr, this.y);
			break;
		case jsSID.MOS6510.inst.tax:
			this.cycles += 2;
			this.x = this.a;
			this.setflags(jsSID.MOS6510.flag.Z, !this.x);
			this.setflags(jsSID.MOS6510.flag.N, this.x & 0x80);
			break;
		case jsSID.MOS6510.inst.tay:
			this.cycles += 2;
			this.y = this.a;
			this.setflags(jsSID.MOS6510.flag.Z, !this.y);
			this.setflags(jsSID.MOS6510.flag.N, this.y & 0x80);
			break;
		case jsSID.MOS6510.inst.tsx:
			this.cycles += 2;
			this.x = this.s;
			this.setflags(jsSID.MOS6510.flag.Z, !this.x);
			this.setflags(jsSID.MOS6510.flag.N, this.x & 0x80);
			break;
		case jsSID.MOS6510.inst.txa:
			this.cycles += 2;
			this.a = this.x;
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			break;
		case jsSID.MOS6510.inst.txs:
			this.cycles += 2;
			this.s = this.x;
			break;
		case jsSID.MOS6510.inst.tya:
			this.cycles += 2;
			this.a = this.y;
			this.setflags(jsSID.MOS6510.flag.Z, !this.a);
			this.setflags(jsSID.MOS6510.flag.N, this.a & 0x80);
			break;
		default:
		console.log("cpuParse: attempted unhandled instruction, opcode: ", opc);
	}
	return this.cycles;

};

jsSID.MOS6510.prototype.cpuJSR = function(npc, na) {
	var ccl = 0;

	this.a = na;
	this.x = 0;
	this.y = 0;
	this.p = 0;
	this.s = 255;
	this.pc = npc;
	this.push(0);
	this.push(0);

	while (this.pc > 1) {
		ccl += this.cpuParse();
	}
	return ccl;
};

// Flags Enum
jsSID.MOS6510.flag = Object.freeze ({
	N: 128, V: 64, B: 16, D: 8, I: 4, Z: 2, C: 1
});


// Opcodes Enum
jsSID.MOS6510.inst = Object.freeze ({
  adc: {}, and: {}, asl: {}, bcc: {}, bcs: {}, beq: {}, bit: {}, bmi: {}, bne: {}, bpl: {}, brk: {}, bvc: {}, bvs: {}, clc: {},
  cld: {}, cli: {}, clv: {}, cmp: {}, cpx: {}, cpy: {}, dec: {}, dex: {}, dey: {}, eor: {}, inc: {}, inx: {}, iny: {}, jmp: {},
  jsr: {}, lda: {}, ldx: {}, ldy: {}, lsr: {}, nop: {}, ora: {}, pha: {}, php: {}, pla: {}, plp: {}, rol: {}, ror: {}, rti: {},
  rts: {}, sbc: {}, sec: {}, sed: {}, sei: {}, sta: {}, stx: {}, sty: {}, tax: {}, tay: {}, tsx: {}, txa: {}, txs: {}, tya: {},
  xxx: {}
});

// Modes Enum
jsSID.MOS6510.mode = Object.freeze ({
   imp: {}, imm: {}, abs: {}, absx: {}, absy: {}, zp: {}, zpx: {}, zpy: {}, ind: {}, indx: {}, indy: {}, acc: {}, rel: {}, xxx: {}
});


// 256 entries, each entry array pair of [inst, mode]
jsSID.MOS6510.opcodes = new Array(
	[jsSID.MOS6510.inst.brk, jsSID.MOS6510.mode.imp],							// 0x00
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.indx],							// 0x01
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x02
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x03
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.zp],							// 0x04
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.zp],							// 0x05
	[jsSID.MOS6510.inst.asl, jsSID.MOS6510.mode.zp],							// 0x06
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x07
	[jsSID.MOS6510.inst.php, jsSID.MOS6510.mode.imp],							// 0x08
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.imm],							// 0x09
	[jsSID.MOS6510.inst.asl, jsSID.MOS6510.mode.acc],							// 0x0a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x0b
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.abs],							// 0x0c
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.abs],							// 0x0d
	[jsSID.MOS6510.inst.asl, jsSID.MOS6510.mode.abs],							// 0x0e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x0f

	[jsSID.MOS6510.inst.bpl, jsSID.MOS6510.mode.rel],							// 0x10
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.indy],							// 0x11
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x12
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x13
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x14
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.zpx],							// 0x15
	[jsSID.MOS6510.inst.asl, jsSID.MOS6510.mode.zpx],							// 0x16
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x17
	[jsSID.MOS6510.inst.clc, jsSID.MOS6510.mode.imp],							// 0x18
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.absy],							// 0x19
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x1a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x1b
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x1c
	[jsSID.MOS6510.inst.ora, jsSID.MOS6510.mode.absx],							// 0x1d
	[jsSID.MOS6510.inst.asl, jsSID.MOS6510.mode.absx],							// 0x1e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x1f

	[jsSID.MOS6510.inst.jsr, jsSID.MOS6510.mode.abs],							// 0x20
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.indx],							// 0x21
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x22
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x23
	[jsSID.MOS6510.inst.bit, jsSID.MOS6510.mode.zp],							// 0x24
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.zp],							// 0x25
	[jsSID.MOS6510.inst.rol, jsSID.MOS6510.mode.zp],							// 0x26
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x27
	[jsSID.MOS6510.inst.plp, jsSID.MOS6510.mode.imp],							// 0x28
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.imm],							// 0x29
	[jsSID.MOS6510.inst.rol, jsSID.MOS6510.mode.acc],							// 0x2a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x2b
	[jsSID.MOS6510.inst.bit, jsSID.MOS6510.mode.abs],							// 0x2c
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.abs],							// 0x2d
	[jsSID.MOS6510.inst.rol, jsSID.MOS6510.mode.abs],							// 0x2e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x2f

	[jsSID.MOS6510.inst.bmi, jsSID.MOS6510.mode.rel],							// 0x30
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.indy],							// 0x31
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x32
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x33
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x34
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.zpx],							// 0x35
	[jsSID.MOS6510.inst.rol, jsSID.MOS6510.mode.zpx],							// 0x36
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x37
	[jsSID.MOS6510.inst.sec, jsSID.MOS6510.mode.imp],							// 0x38
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.absy],							// 0x39
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x3a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x3b
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x3c
	[jsSID.MOS6510.inst.and, jsSID.MOS6510.mode.absx],							// 0x3d
	[jsSID.MOS6510.inst.rol, jsSID.MOS6510.mode.absx],							// 0x3e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x3f

	[jsSID.MOS6510.inst.rti, jsSID.MOS6510.mode.imp],							// 0x40
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.indx],							// 0x41
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x42
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x43
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.zp],							// 0x44
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.zp],							// 0x45
	[jsSID.MOS6510.inst.lsr, jsSID.MOS6510.mode.zp],							// 0x46
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x47
	[jsSID.MOS6510.inst.pha, jsSID.MOS6510.mode.imp],							// 0x48
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.imm],							// 0x49
	[jsSID.MOS6510.inst.lsr, jsSID.MOS6510.mode.acc],							// 0x4a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x4b
	[jsSID.MOS6510.inst.jmp, jsSID.MOS6510.mode.abs],							// 0x4c
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.abs],							// 0x4d
	[jsSID.MOS6510.inst.lsr, jsSID.MOS6510.mode.abs],							// 0x4e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x4f

	[jsSID.MOS6510.inst.bvc, jsSID.MOS6510.mode.rel],							// 0x50
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.indy],							// 0x51
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x52
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x53
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x54
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.zpx],							// 0x55
	[jsSID.MOS6510.inst.lsr, jsSID.MOS6510.mode.zpx],							// 0x56
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x57
	[jsSID.MOS6510.inst.cli, jsSID.MOS6510.mode.imp],							// 0x58
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.absy],							// 0x59
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x5a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x5b
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x5c
	[jsSID.MOS6510.inst.eor, jsSID.MOS6510.mode.absx],							// 0x5d
	[jsSID.MOS6510.inst.lsr, jsSID.MOS6510.mode.absx],							// 0x5e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x5f

	[jsSID.MOS6510.inst.rts, jsSID.MOS6510.mode.imp],							// 0x60
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.indx],							// 0x61
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x62
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x63
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.zp],							// 0x64
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.zp],							// 0x65
	[jsSID.MOS6510.inst.ror, jsSID.MOS6510.mode.zp],							// 0x66
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x67
	[jsSID.MOS6510.inst.pla, jsSID.MOS6510.mode.imp],							// 0x68
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.imm],							// 0x69
	[jsSID.MOS6510.inst.ror, jsSID.MOS6510.mode.acc],							// 0x6a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x6b
	[jsSID.MOS6510.inst.jmp, jsSID.MOS6510.mode.ind],							// 0x6c
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.abs],							// 0x6d
	[jsSID.MOS6510.inst.ror, jsSID.MOS6510.mode.abs],							// 0x6e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x6f

	[jsSID.MOS6510.inst.bvs, jsSID.MOS6510.mode.rel],							// 0x70
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.indy],							// 0x71
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x72
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x73
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x74
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.zpx],							// 0x75
	[jsSID.MOS6510.inst.ror, jsSID.MOS6510.mode.zpx],							// 0x76
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x77
	[jsSID.MOS6510.inst.sei, jsSID.MOS6510.mode.imp],							// 0x78
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.absy],							// 0x79
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x7a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x7b
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x7c
	[jsSID.MOS6510.inst.adc, jsSID.MOS6510.mode.absx],							// 0x7d
	[jsSID.MOS6510.inst.ror, jsSID.MOS6510.mode.absx],							// 0x7e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x7f

	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.imm],							// 0x80
	[jsSID.MOS6510.inst.sta, jsSID.MOS6510.mode.indx],							// 0x81
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x82
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x83
	[jsSID.MOS6510.inst.sty, jsSID.MOS6510.mode.zp],							// 0x84
	[jsSID.MOS6510.inst.sta, jsSID.MOS6510.mode.zp],							// 0x85
	[jsSID.MOS6510.inst.stx, jsSID.MOS6510.mode.zp],							// 0x86
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x87
	[jsSID.MOS6510.inst.dey, jsSID.MOS6510.mode.imp],							// 0x88
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.imm],							// 0x89
	[jsSID.MOS6510.inst.txa, jsSID.MOS6510.mode.acc],							// 0x8a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x8b
	[jsSID.MOS6510.inst.sty, jsSID.MOS6510.mode.abs],							// 0x8c
	[jsSID.MOS6510.inst.sta, jsSID.MOS6510.mode.abs],							// 0x8d
	[jsSID.MOS6510.inst.stx, jsSID.MOS6510.mode.abs],							// 0x8e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x8f

	[jsSID.MOS6510.inst.bcc, jsSID.MOS6510.mode.rel],							// 0x90
	[jsSID.MOS6510.inst.sta, jsSID.MOS6510.mode.indy],							// 0x91
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x92
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x93
	[jsSID.MOS6510.inst.sty, jsSID.MOS6510.mode.zpx],							// 0x94
	[jsSID.MOS6510.inst.sta, jsSID.MOS6510.mode.zpx],							// 0x95
	[jsSID.MOS6510.inst.stx, jsSID.MOS6510.mode.zpy],							// 0x96
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x97
	[jsSID.MOS6510.inst.tya, jsSID.MOS6510.mode.imp],							// 0x98
	[jsSID.MOS6510.inst.sta, jsSID.MOS6510.mode.absy],							// 0x99
	[jsSID.MOS6510.inst.txs, jsSID.MOS6510.mode.acc],							// 0x9a
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x9b
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x9c
	[jsSID.MOS6510.inst.sta, jsSID.MOS6510.mode.absx],							// 0x9d
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.absx],							// 0x9e
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0x9f

	[jsSID.MOS6510.inst.ldy, jsSID.MOS6510.mode.imm],							// 0xa0
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.indx],							// 0xa1
	[jsSID.MOS6510.inst.ldx, jsSID.MOS6510.mode.imm],							// 0xa2
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xa3
	[jsSID.MOS6510.inst.ldy, jsSID.MOS6510.mode.zp],							// 0xa4
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.zp],							// 0xa5
	[jsSID.MOS6510.inst.ldx, jsSID.MOS6510.mode.zp],							// 0xa6
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xa7
	[jsSID.MOS6510.inst.tay, jsSID.MOS6510.mode.imp],							// 0xa8
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.imm],							// 0xa9
	[jsSID.MOS6510.inst.tax, jsSID.MOS6510.mode.acc],							// 0xaa
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xab
	[jsSID.MOS6510.inst.ldy, jsSID.MOS6510.mode.abs],							// 0xac
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.abs],							// 0xad
	[jsSID.MOS6510.inst.ldx, jsSID.MOS6510.mode.abs],							// 0xae
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xaf

	[jsSID.MOS6510.inst.bcs, jsSID.MOS6510.mode.rel],							// 0xb0
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.indy],							// 0xb1
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xb2
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xb3
	[jsSID.MOS6510.inst.ldy, jsSID.MOS6510.mode.zpx],							// 0xb4
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.zpx],							// 0xb5
	[jsSID.MOS6510.inst.ldx, jsSID.MOS6510.mode.zpy],							// 0xb6
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xb7
	[jsSID.MOS6510.inst.clv, jsSID.MOS6510.mode.imp],							// 0xb8
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.absy],							// 0xb9
	[jsSID.MOS6510.inst.tsx, jsSID.MOS6510.mode.acc],							// 0xba
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xbb
	[jsSID.MOS6510.inst.ldy, jsSID.MOS6510.mode.absx],							// 0xbc
	[jsSID.MOS6510.inst.lda, jsSID.MOS6510.mode.absx],							// 0xbd
	[jsSID.MOS6510.inst.ldx, jsSID.MOS6510.mode.absy],							// 0xbe
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xbf

	[jsSID.MOS6510.inst.cpy, jsSID.MOS6510.mode.imm],							// 0xc0
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.indx],							// 0xc1
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xc2
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xc3
	[jsSID.MOS6510.inst.cpy, jsSID.MOS6510.mode.zp],							// 0xc4
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.zp],							// 0xc5
	[jsSID.MOS6510.inst.dec, jsSID.MOS6510.mode.zp],							// 0xc6
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xc7
	[jsSID.MOS6510.inst.iny, jsSID.MOS6510.mode.imp],							// 0xc8
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.imm],							// 0xc9
	[jsSID.MOS6510.inst.dex, jsSID.MOS6510.mode.acc],							// 0xca
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xcb
	[jsSID.MOS6510.inst.cpy, jsSID.MOS6510.mode.abs],							// 0xcc
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.abs],							// 0xcd
	[jsSID.MOS6510.inst.dec, jsSID.MOS6510.mode.abs],							// 0xce
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xcf

	[jsSID.MOS6510.inst.bne, jsSID.MOS6510.mode.rel],							// 0xd0
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.indy],							// 0xd1
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xd2
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xd3
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.zpx],							// 0xd4
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.zpx],							// 0xd5
	[jsSID.MOS6510.inst.dec, jsSID.MOS6510.mode.zpx],							// 0xd6
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xd7
	[jsSID.MOS6510.inst.cld, jsSID.MOS6510.mode.imp],							// 0xd8
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.absy],							// 0xd9
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.acc],							// 0xda
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xdb
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xdc
	[jsSID.MOS6510.inst.cmp, jsSID.MOS6510.mode.absx],							// 0xdd
	[jsSID.MOS6510.inst.dec, jsSID.MOS6510.mode.absx],							// 0xde
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xdf

	[jsSID.MOS6510.inst.cpx, jsSID.MOS6510.mode.imm],							// 0xe0
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.indx],							// 0xe1
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xe2
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xe3
	[jsSID.MOS6510.inst.cpx, jsSID.MOS6510.mode.zp],							// 0xe4
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.zp],							// 0xe5
	[jsSID.MOS6510.inst.inc, jsSID.MOS6510.mode.zp],							// 0xe6
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xe7
	[jsSID.MOS6510.inst.inx, jsSID.MOS6510.mode.imp],							// 0xe8
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.imm],							// 0xe9
	[jsSID.MOS6510.inst.nop, jsSID.MOS6510.mode.acc],							// 0xea
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xeb
	[jsSID.MOS6510.inst.cpx, jsSID.MOS6510.mode.abs],							// 0xec
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.abs],							// 0xed
	[jsSID.MOS6510.inst.inc, jsSID.MOS6510.mode.abs],							// 0xee
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xef

	[jsSID.MOS6510.inst.beq, jsSID.MOS6510.mode.rel],							// 0xf0
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.indy],							// 0xf1
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xf2
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xf3
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.zpx],							// 0xf4
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.zpx],							// 0xf5
	[jsSID.MOS6510.inst.inc, jsSID.MOS6510.mode.zpx],							// 0xf6
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xf7
	[jsSID.MOS6510.inst.sed, jsSID.MOS6510.mode.imp],							// 0xf8
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.absy],							// 0xf9
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.acc],							// 0xfa
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xfb
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx],							// 0xfc
	[jsSID.MOS6510.inst.sbc, jsSID.MOS6510.mode.absx],							// 0xfd
	[jsSID.MOS6510.inst.inc, jsSID.MOS6510.mode.absx],							// 0xfe
	[jsSID.MOS6510.inst.xxx, jsSID.MOS6510.mode.xxx]							// 0xff
);


