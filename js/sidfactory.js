
function SIDFactory() {
}

SIDFactory.quality = Object.freeze({
        low: ["TinySID", null],
        medium: ["FastSID", null],
        good: ["ReSID Fast", SID.sampling_method.SAMPLE_FAST],
        better: ["ReSID Interpolate", SID.sampling_method.SAMPLE_INTERPOLATE],
        best: ["ReSID Resample/Interpolate", SID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE],
        broken: ["ReSID Resample/Fast", SID.sampling_method.SAMPLE_RESAMPLE_FAST]
        // FIXME: Make above less broken
});

SIDFactory.prototype.create = function(f_opts) {
        console.log("factory", f_opts);
        f_opts = f_opts || {};
        var f_quality = f_opts.quality || SIDFactory.quality.good;
        var f_clock = f_opts.clock || SID.const.CLK_PAL;
        var f_sampleRate = f_opts.mixrate || 44100;
        var f_newsid;
        if(f_quality == SIDFactory.quality.low) {
                f_newsid = new SidSynth(f_sampleRate);
        } else if (f_quality == SIDFactory.quality.medium) {
                f_newsid = new FastSID({ sampleRate: f_sampleRate, clock: f_clock });
        } else {
                f_newsid = new SID(f_sampleRate, f_clock, f_quality[1]);
        }
        return f_newsid;
};

