
jsSID.Factory = function() {
};

//jsSID.Factory.quality = Object.freeze({
//        low: ["TinySID", null],
//        medium: ["FastSID", null],
//        good: ["ReSID Fast", jsSID.ReSID.sampling_method.SAMPLE_FAST],
//        better: ["ReSID Interpolate", jsSID.ReSID.sampling_method.SAMPLE_INTERPOLATE],
//        best: ["ReSID Resample/Interpolate", jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE],
//        broken: ["ReSID Resample/Fast", jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST]
//        // FIXME: Make above less broken
//});

jsSID.Factory.prototype.create = function(f_opts) {
        console.log("factory", f_opts);
        f_opts = f_opts || {};
        var f_quality = f_opts.quality || jsSID.quality.good;
        var engine = jsSID.synth[f_quality];
       
        var o = {};
	var key;
        for(key in engine.opts) {
          o[key] = engine.opts[key];
        }
        for(key in f_opts) {
          o[key] = f_opts[key];
        }

        o.clock = o.clock || jsSID.chip.clock.PAL;
        o.model = o.model || jsSID.chip.model.MOS6581;
        o.sampleRate = o.sampleRate || 44100;

        console.log("factory, class:", engine.class);
        var f_newsid = new window.jsSID[engine.class](o);
        return f_newsid;
};

