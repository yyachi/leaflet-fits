L.LeafletFitsGL.Plotty = L.LeafletFitsRenderer.extend({

    options: {
        colorScale: 'viridis',
        clampLow: true,
        clampHigh: true,
        displayMin: 0,
        displayMax: 1
    },

    initialize: function (options) {
        if (typeof (plotty) === 'undefined') {
            throw new Error("plotty not defined");
        }
        this.name = "Plotty";

        L.setOptions(this, options);

        this._preLoadColorScale();
    },

    setColorScale: function (colorScale) {
        this.options.colorScale = colorScale;
        this.parent._reset();
    },

    setDisplayRange: function (min, max) {
        this.options.displayMin = min;
        this.options.displayMax = max;
        this.parent._reset();
    },

    _preLoadColorScale: function () {
        var canvas = document.createElement('canvas');
        var plot = new plotty.plot({
            canvas: canvas,
            data: [0],
            width: 1, height: 1,
            domain: [this.options.displayMin, this.options.displayMax],
            colorScale: this.options.colorScale,
            clampLow: this.options.clampLow,
            clampHigh: this.options.clampHigh,
        });
        this.colorScaleData = plot.colorScaleCanvas.toDataURL();
    },

    render: function (raster, args) {
        var plottyCanvas = document.createElement("canvas");
        var plot = new plotty.plot({
            data: raster.data,
            width: raster.width, height: raster.height,
            domain: [this.options.displayMin, this.options.displayMax],
            colorScale: this.options.colorScale,
            clampLow: this.options.clampLow,
            clampHigh: this.options.clampHigh,
            canvas: plottyCanvas,
            useWebGL: false
        });
        plot.setNoDataValue(-9999);
        plot.render();

        this.colorScaleData = plot.colorScaleCanvas.toDataURL();

        var rasterImageData = plottyCanvas.getContext("2d").getImageData(0, 0, plottyCanvas.width, plottyCanvas.height);
        var inData = rasterImageData.data;
        var inPixelsU32 = new Uint32Array(inData.buffer);

        raster.imageData = rasterImageData;
        raster.inPixelsU32 = inPixelsU32;
    }

});

L.LeafletFitsGL.plotty = function (options) {
    return new L.LeafletFitsGL.Plotty(options);
};
