L.LeafletFitsGL = L.Layer.extend({
    initialize: function (url, options) {

        this._url = url;
        this.raster = {};
        L.Util.setOptions(this, options);

        if (this.options.bounds) {
            //this._rasterBounds = L.latLngBounds(options.bounds);
            this._rasterBounds = options.bounds;
        }
        if (this.options.corners) {
            this._rasterCorners = options.corners;
        }
        if (this.options.renderer) {
            this.options.renderer.setParent(this);
        }
        //this._getData();
    },
    _getData: function () {
        var self = this;
        // Initialize a new FITS File object
        var FITS = astro.FITS;
        // Define a callback function for when the FITS file is received
        var callback = function () {
            // Get the first header-dataunit containing a dataunit
            var hdu = this.getHDU();
            // Get the first header
            var header = hdu.header;
            //var w = wcs();
            //w.init(header);
            // Read a card from the header
            var bitpix = header.get('BITPIX');
            // Get the dataunit object
            var dataunit = hdu.data;
            // Do some wicked client side processing ...
            var height = hdu.data.height;
            var width = hdu.data.width;
            var buf = dataunit.buffer;
            var dataview = new DataView(buf);
            var exampledata = new Float64Array(height * width);
            byteOffset = 0;
            for (y = 0; y < height; y++) {
                for (x = 0; x < width; x++) {
                    exampledata[(y * width) + x] = dataview.getFloat64(byteOffset);
                    byteOffset += 8;
                }
            }

            self.raster.data = exampledata;
            self.raster.width = width;
            self.raster.height = height;
            if (self._rasterCorners) {
                var m = Matrix.fromTriangles([0, 0, width, 0, width, height], [self._rasterCorners[0], self._rasterCorners[1], self._rasterCorners[2]].flat());
                self.raster.ij2world = m;
                self.raster.world2ij = m.inverse()
                var latLngCorners = [
                    self.options.world2latLng(self._rasterCorners[0]),
                    self.options.world2latLng(self._rasterCorners[1]),
                    self.options.world2latLng(self._rasterCorners[2]),
                    self.options.world2latLng(self._rasterCorners[3]),
                ];
                var mm = Matrix.fromTriangles([0, 0, width, 0, width, height], [latLngCorners[0].lat, latLngCorners[0].lng, latLngCorners[1].lat, latLngCorners[1].lng, latLngCorners[2].lat, latLngCorners[2].lng]);
                var ij2latLng = mm;
                var aij = new Int32Array(new ArrayBuffer(width * height * 4 * 2));
                var cij = new Float32Array(new ArrayBuffer(width * height * 4 * 8));
                var ijArray = [];
                for (i = 0; i < height; i++) {
                    for (j = 0; j < width; j++) {
                        var index = (i * height + j);
                        //ijArray = ijArray.concat([i,j]);
                        aij[index * 2] = j;
                        aij[index * 2 + 1] = i;
                        l = j - 0.5;
                        r = j + 0.5;
                        u = i - 0.5;
                        b = i + 0.5;
                        cij[index * 8 + 0] = l;
                        cij[index * 8 + 1] = u;
                        cij[index * 8 + 2] = r;
                        cij[index * 8 + 3] = u;
                        cij[index * 8 + 4] = r;
                        cij[index * 8 + 5] = b;
                        cij[index * 8 + 6] = l;
                        cij[index * 8 + 7] = b;
                    }
                }
                var latLngArray = ij2latLng.applyToArray(aij);
                var clatLngArray = ij2latLng.applyToArray(cij);
                var latLngs = []
                for (i = 0; i < latLngArray.length / 2; i++) {
                    latLngs[i] = [latLngArray[i * 2], latLngArray[i * 2 + 1]];
                }
                self.raster.latLngs = latLngs;
                var features = []
                for (i = 0; i < clatLngArray.length / 8; i++) {
                    features[i] = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [clatLngArray[i * 8 + 1], clatLngArray[i * 8 + 0]],
                                    [clatLngArray[i * 8 + 3], clatLngArray[i * 8 + 2]],
                                    [clatLngArray[i * 8 + 5], clatLngArray[i * 8 + 4]],
                                    [clatLngArray[i * 8 + 7], clatLngArray[i * 8 + 6]]
                                ]
                                //[
                                //[latLngArray[1], latLngArray[0]],
                                //[latLngArray[3], latLngArray[2]],
                                //[latLngArray[5], latLngArray[4]],
                                //[latLngArray[7], latLngArray[6]]
                                //]
                            ]
                        }
                    }
                }
                self.raster.features = features;
            }
            self._reset();
        };
        this.fits = new FITS(this._url, callback);
    },
    setColorScale: function (colorScale) {
        this.options.renderer.setColorScale(colorScale);
    },
    setDisplayRange: function (min, max) {
        this.options.renderer.setDisplayRange(min, max);
    },
    setOpacity: function (opacity) {
        this.options.opacity = opacity;
        this._reset()
    },
    _initPoints: function () {
        if (this.hasOwnProperty('_map')) {
            if (this._rasterBounds) {
                this._drawImage();
                if (this.raster.latLngs) {
                    var data = this.raster.imageData.data;
                    this._points = L.glify.shapes({
                        map: this._map,
                        data: {
                            "type": "FeatureCollection",
                            "features": this.raster.features
                        },
                        color: function (index, feature) {
                            i = index * 4;
                            rgb = { r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255 };
                            return rgb;
                        },
                        opacity: this.options.opacity,
                        click: function (e, feature) {
                            // do something when a shape is clicked
                            // return false to continue traversing
                            console.log(feature);
                        }
                    });
                    L.Util.setOptions(this._points.layer, { visible: this.options.visible, parent: this });
                };
            };
        };
    },
    _reset: function () {
        if (this.hasOwnProperty('_map')) {
            if (this._rasterBounds) {
                this._drawImage();
                if (this.raster.latLngs) {
                    var data = this.raster.imageData.data;
                    if (!this._points) {
                        this._initPoints();
                    }
                    if (this._points) {
                        this._points.settings.color = function (index, feature) {
                            i = index * 4;
                            rgb = { r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255 };
                            return rgb;
                        };
                        this._points.setData({
                            "type": "FeatureCollection",
                            "features": this.raster.features
                        });
                        this._points.settings.opacity = this.options.opacity;
                        this._points.render();
                    }
                }
            };
        };
    },
    _drawImage: function () {
        if (this.raster.hasOwnProperty('data')) {
            var args = {};
            this.options.renderer.render(this.raster, args);
        }
    },
    onAdd: function (map) {
        this._map = map;
        if (!this.fits) {
            this._getData();
        }
        if (!this._points) {
            this._initPoints();
        }
        if (this._points) {
            this._points.addTo(map);
        }
    },
    onRemove: function (map) {
        if (this._points) {
            this._points.remove();
        }
    },
});


L.LeafletFitsRenderer = L.Class.extend({

    initialize: function (options) {
        L.setOptions(this, options);
    },

    setParent: function (parent) {
        this.parent = parent;
    },

    render: function (raster, canvas, ctx, args) {
        throw new Error('Abstract class');
    }

});

L.leafletFitsGL = function (url, options) {
    return new L.LeafletFitsGL(url, options);
};
