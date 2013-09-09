/*
class to load the .sid file into a 64k array
(depends on stream.js)
*/
function SidFile(data) {
	// very simply, just splitting into the 25 byte frames
	var stream = Stream(data);

	var ret = {};

	stream.seek(0x07);
	ret.data_offset = stream.readInt8();		// 0x07
	console.log("offset   : ", ret.data_offset);
	ret.not_load_addr   = stream.readInt16();		// 0x08
	//console.log("not load addr: ", ret.not_load_addr);
	ret.init_addr   = stream.readInt16();		// 0x0a
	console.log("init addr: ", ret.init_addr);
	ret.play_addr   = stream.readInt16();		// 0x0c
	console.log("play addr: ", ret.play_addr);

	stream.seek(0x0f);
	ret.subsongs    = stream.readInt8() - 1;		// 0x0f
	console.log("subsongs : ", ret.subsongs);
	stream.seek(0x11);
	ret.startsong   = stream.readInt8() - 1;		// 0x11
	console.log("startsong: ", ret.startsong);

	stream.seek(0x15);
	ret.speed       = stream.readInt8();		// 0x15
	console.log("speed    : " , ret.speed ? 100 : 50 ," hz");

	stream.seek(0x16);
	ret.name = stream.read(32);
	console.log("name     : ", ret.name);
	stream.seek(0x36);
	ret.author = stream.read(32);
	console.log("author   : ", ret.author);
	stream.seek(0x56);
	ret.copyright = stream.read(32);
	console.log("copyright: ", ret.copyright);

	stream.seek(ret.data_offset);
	ret.load_addr       = stream.readInt8();
	ret.load_addr      |= stream.readInt8() << 8;
	console.log("load addr: ", ret.load_addr);
	var loadptr = ret.load_addr;

	// create new memory array and zero
	ret.mem = new Array(65536);
	for(var i=0; i<65536; i++) {
		ret.mem[i]=0;
	}

	while (!stream.eof()) {
		ret.mem[loadptr] = stream.readInt8();
		loadptr++;
	}

	// returns header plus offset memory image
	return ret;
}

