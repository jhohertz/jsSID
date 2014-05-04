
jsSID.Factory = function() {
};

jsSID.Factory.quality = Object.freeze({
        low: ["TinySID", null],
        medium: ["FastSID", null],
        good: ["ReSID Fast", jsSID.ReSID.sampling_method.SAMPLE_FAST],
        better: ["ReSID Interpolate", jsSID.ReSID.sampling_method.SAMPLE_INTERPOLATE],
        best: ["ReSID Resample/Interpolate", jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE],
        broken: ["ReSID Resample/Fast", jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST]
        // FIXME: Make above less broken
});

jsSID.Factory.prototype.create = function(f_opts) {
        console.log("factory", f_opts);
        f_opts = f_opts || {};
        var f_quality = f_opts.quality || jsSID.Factory.quality.good;
        var f_clock = f_opts.clock || jsSID.chip.clock.PAL;
        var f_sampleRate = f_opts.mixrate || 44100;
        var f_newsid;
        if(f_quality == jsSID.Factory.quality.low) {
                f_newsid = new jsSID.TinySID({ sampleRate: f_sampleRate });
        } else if (f_quality == jsSID.Factory.quality.medium) {
                f_newsid = new jsSID.FastSID({ sampleRate: f_sampleRate, clock: f_clock });
        } else {
                f_newsid = new jsSID.ReSID({ sampleRate: f_sampleRate, clock: f_clock, method: f_quality[1] });
        }
        return f_newsid;
};

