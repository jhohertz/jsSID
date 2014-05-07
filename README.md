## jsSID

jsSID is a javascript port of several emulations of the [SID](http://en.wikipedia.org/wiki/MOS_Technology_SID) sound generator chip as used in the Commodore 64.

- TinySID (from rockbox)
  - the [MOS6510 CPU](http://en.wikipedia.org/wiki/MOS_Technology_6510) emulation inspired by this.
- [ReSID](http://en.wikipedia.org/wiki/ReSID) (from libsidplay)
- FastSID (from vice)
- ReSID-NG (from vice, not yet working, behind on integration, bit rotted, waiting on other cleanups before bringing it back.)

It has been integrated enough to allow players to swap between implementations of the SID, and for all but tinysid (which has no settings really), set the sid frequency (IE: NTSC/PAL), and set the model (6581 or 8550) to emulate. A SID implementation can register multiple configurations of itself. ReSID uses this to expose its sampling configurations.

The 6510 was adapted from tinysid. And aside from the SID, the CPU, and RAM, there is no hardware emulated aside from a simulated timer interval, either retrace based, or CIA, driven by the sample acquisition loop.

There is not (yet) any support for 'digi' samples in sid files. This can be seen in the SID file Electronic Transfer which works fine but for the samples. Tinysid has some dormant code, but the method VICE uses would be better, and is how FastSID and ReSID are usually paired to an implementation of digi support external to themselves.

## About the ports

This code is hand ported from the C sources. Some parts have been adapted to be more javascript friendly, re: data structures mostly, but at the higher levels is fairly true to C code.

A consequence of some of this, is needing to manage C-like expectations on some of the mechanics of rollover or signedness on various types, like 32 or 16 bit. In some cases there may be overly paranoid checking that could be toned down.

There are also places there are simulations of concepts alien to C, but available in Javascript (IE: Infinity) that could probably simplify some code quite if factored out.







