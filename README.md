## jsSID

First, pop a tab with the [demo player](http://jhohertz.github.io/jsSID) and get some music going.

jsSID is a javascript port of *several* emulations of the [SID](http://en.wikipedia.org/wiki/MOS_Technology_SID) sound generator chip as used in the [Commodore 64](http://en.wikipedia.org/wiki/Commodore_64). These are native rewrites in javascript vs. using an [asm.js](http://asmjs.org/) compiler. They were written in September 2013, and recently cleaned up and released June 29, 2014.

The emulations converted include:

- TinySID ([from rockbox](http://git.rockbox.org/?p=rockbox.git;a=blob_plain;f=lib/rbcodec/codecs/sid.c;hb=refs/heads/master))
  - the [MOS6510 CPU](http://en.wikipedia.org/wiki/MOS_Technology_6510) emulation and player code is inspired by this.
- [ReSID](http://en.wikipedia.org/wiki/ReSID) (from libsidplay)
- FastSID (from [vice](http://vice-emu.sourceforge.net/))
- ReSID-NG (from vice, not yet working, behind on integration, bit rotted, waiting on other cleanups before bringing it back. it sounds amazing until it doesn't).

Read on to learn more about jsSID, or just enjoy the music. :)

<!--fold-->

It has been integrated enough to allow players to swap between implementations of the SID. Both a sid-file player, and a player that plays back register dumps are provided. The demo will let you explore all the working engines and configurations.

If you want to hear the differences between the engines the Mr. Marvelous register dump exposes the most obvious differences. It is known for using many of the undefined and undocumented effects of the SID chip, and makes a good test for accuracy of the synthesizers. In some cases the lo-fi makes for some rather awesome side effects. Those who like low bass, try the Autumn register dump on low quality setting. (It's great on all settings, but the low gives it some brain-rattling effects).

For all but TinySID (which has no settings really), you can set the SID frequency (IE: NTSC/PAL), and set the model (6581 or 8550) to emulate. A SID implementation can register multiple configurations of itself. ReSID uses this to expose its various sampling configurations.

The 6510 was adapted from tinysid. And aside from the SID, the CPU, and RAM, there is no hardware emulated aside from a simulated timer interval, either retrace based, or CIA, driven by the sample acquisition loop.

There is not (yet) any support for 'digi' samples in sid files. This can be seen in the SID file Electronic Transfer which works fine but for the samples. TinySID has some dormant code, but the method VICE uses would be better, and is how FastSID and ReSID are usually paired to an implementation of digi support external to themselves.

Also, the format of SID file supported it is probably ancient relative to the latest standards. The SIDs I used were extracted from a 10-15 year old copy of the [High Voltage SID Collection](http://www.hvsc.c64.org/).

Sub-songs in a SID file are supported, although there are some bugs (transport control state on mobile disables wrong buttons sometimes, some SIDs report songs that do not seem to work, Monty on the Run track 2 will freeze the browser if it completes)

This code is hand ported from the C sources. Some parts have been adapted to be more javascript friendly, re: data structures mostly, but at the higher levels is fairly true to C code. A consequence of some of this, is needing to manage C-like expectations on some of the mechanics of rollover or signedness on various types, like 32 or 16 bit. In some cases there may be overly paranoid checking that could be toned down. There are also places there are simulations of concepts alien to C, but available in Javascript (IE: Infinity) that could probably simplify some code quite if factored out.

Lastly, there is no nice build/packaging yet. I'd like to wrap this as an NPM/Bower package with all the fixings soon.

Anyhow, I hope you've enjoyed the music if nothing else!

@jhohertz

