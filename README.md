## jsSID

jsSID is a javascript port of several emulations of the [SID](http://en.wikipedia.org/wiki/MOS_Technology_SID) sound generator chip as used in the Commodore 64.

- TinySID (from rockbox)
  - the [MOS6510 CPU](http://en.wikipedia.org/wiki/MOS_Technology_6510) emulation inspired by this.
- [ReSID](http://en.wikipedia.org/wiki/ReSID) (from libsidplay)
- FastSID (from vice)
- ReSID-NG (from vice, not yet working, behind on integration)

It has been integrated enough to allow players to swap between implementations of the SID, with some work pending to get all the settings exposed in a general way.






