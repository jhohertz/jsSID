/*
class to load the .dmp sid dump file format
60 frames per second of 25 bytes, representing the sid register states
(depends on stream.js)
*/
function SidDmpFile(data) {
	// very simply, just splitting into the 25 byte frames
	var stream = Stream(data);

	var frames = new Array;
	while (!stream.eof()) {
		var frame = stream.read(25);
		frames.push(frame);
	}

	return frames;
}

