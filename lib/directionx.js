/** @preserve directionX.js (c) 2021 Ogewan, MIT*/
/**
 * @suppress {globalThis}
 */
/**
 * @function direction
 * @param {string|string[]} [input] - An space delimited list of image sources,
 *     or an array of image sources
 * @param {Object}          [config] - Configuration options
 * @param {number}          [config.overwrite] - Integer ID of starting page.
 *     [1].
 * @param {HTMLElement}     [config.anchor] - HTMLElement to append the carousel
 *     to. [document.body]
 * @param {string}          [config.dir] - The directory containing the images.
 * @param {Object}          [config.size] - Size options.
 * @param {number}          [config.size.width] - Configuration options
 * @param {number}          [config.size.height] - Configuration options
 * @param {boolean}         [config.size.scaleToWidth] - Configuration options
 * @param {boolean}         [config.size.scaleToHeight] - Configuration options
 * @param {string}          [config.dir] - The directory containing the images.
 * @param {number}          [config.imgprebuffer] - The # of images to preload
 *     that precede the displayed image. [5]
 * @param {number}          [config.imgpostbuffer] - The # of images to preload
 *     that follow the displayed image. [5]
 * @param {string}          [config.back] - Hexstring for the display canvas's
 *     color. ["#373737"]
 * @param {GPU}             [config.gpu] - GPU class constructor [Requires
 *     GPU.js]
 * @param {Function}        [config.shader] - Kernel function that manipulates
 *     pixel data [Requires GPU.js]
 * @param {Function}        [config.pixelfn] - Function to manually compute
 *     pixel data if GPU.js is not avaliable.
 * [Spinner]
 * @param {boolean}         [config.hideSpin] - Remove the spinner from the page
 *     temporarily. [false]
 * @param {boolean}         [config.disableSpin] - Deactivate the spinner
 *     forever. [false]
 * @param {number}          [config.lines] - The # of lines for the spinner.
 *     [16]
 * @param {number}          [config.rate] - Speed of spinner relative to refresh
 *     rate. [1000/30]
 * @param {number}          [config.diameter] - The diameter of the spinner.
 *     [250]
 * @param {string}          [config.loaderback] - Hexstring for the spinner
 *     background's color. ["#FFF"]
 * @param {string}          [config.color] - Hexstring for the spinner's color.
 *     ["#FFF"]
 *
 */
// TODO: Shader change mechanism for pixelfn and shader, including
// iimg.shaderTime change when shader is changed
// TODO: Redraw on resize canvas, clear canvas and then draw imageBitmap again
// with scale equaling new canvas size
// TODO: reduce size from 6 to under 5 kb
// only body has resize event; <body onresize="myFunction()">, tie canvas size
// to body size perhaps?
export default function direction(input = [], config = {}, dim = [640, 480]) {
  // METHODS - private
  const spin =
      () => {
        if (!spinner) return;
        layers[0].style.paddingLeft = (layers[1].width - 300) / 2 + 'px';
        let rotation = Math.floor((Date.now() - spinner.str) / (1000) * spinner.lne) / spinner.lne,
            color = spinner.clr;
        spinner.ctx.save();
        spinner.ctx.clearRect(0, 0, 300, layers[1].height);
        spinner.ctx.translate(150, layers[1].height / 2);
        spinner.ctx.rotate((Math.PI * 2 * rotation) % (Math.PI * 2));
        // spinner.ctx.rotate(rotation);

        if (color.length == 3) {
          color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
        } else {
          pi(color, 16).toString();
        }

        for (let i = 0; i < spinner.lne; i++) {
          spinner.ctx.beginPath();
          spinner.ctx.rotate(Math.PI * 2 / spinner.lne);
          spinner.ctx.moveTo(spinner.dia / 10, 0);
          spinner.ctx.lineTo(spinner.dia / 4, 0);
          spinner.ctx.lineWidth = spinner.dia / 30;
          spinner.ctx.strokeStyle = color;
          spinner.ctx.stroke();
        }
        spinner.ctx.restore();

        if (spinning)
          raf(spin);
        else
          spinner.ctx.clearRect(0, 0, 300, layers[1].height);
      },
        scrollit =
            (to, time) => {
              // format inputs
              if (to === null || void 0 === to)
                to = {x: 0, y: 0};
              else if (!isNaN(to))
                to = {x: 0, y: to};
              // if to is num assume its y
              else {
                if (to.y === null || void 0 === to.y) to.y = 0;
                if (to.x === null || void 0 === to.x) to.x = 0;
              }
              if (time === null || void 0 === time || time <= 0)
                time = 400;  // ignore given zero time

              // if x or y is less than 0 then go to the bottom
              if (to.y < 0) to.y = window.innerHeight || de.clientHeight || db.clientHeight;
              if (to.x < 0) to.x = window.innerWidth || de.clientWidth || db.clientWidth;

              // calculate distance needed to travel
              let dis = {
                x: window.pageXOffset !== void 0 ? to.x - window.pageXOffset : to.x - de.scrollLeft,
                y: window.pageYOffset !== void 0 ? to.y - window.pageYOffset : to.y - de.scrollTop
              };

              // console.log("to", to, "dis" ,dis, "(x", window.pageXOffset,
              // de.scrollLeft, "| y", window.pageYOffset, de.scrollTop, ")" ,
              // time, time/5);

              // if that distance is 0 on both x and y, no scrolling required
              if (dis == {x: 0, y: 0}) return dis;
              let clock = function(c, b, a) {
                window.scrollBy(Math.floor(c.x) / b, Math.floor(c.y) / b);
                if (a + 1 < b * 5) scrolling = window.setTimeout(clock, 5, c, b, a + 1);
              };
              scrolling = window.setTimeout(clock, 5, dis, Math.floor(time / 5), 0);
              // window.clearInterval(clock);
              return dis;
            },
        draw =
            img => {
              const {width, height} = img;
              ctx.clearRect(
                  0, 0, layers[1].width,
                  layers[1].height);  // clear the canvas based on its size
              cb.run('slidn');

              if (options.sz) {
                // scale to specific dimensions or canvas
                let {w, h, s2w, s2h, s2g, s2l} = options.sz;
                let difw = 1;
                let difh = 1;
                let setW = (w || width);
                let setH = (h || height);

                if (s2g || s2l) {
                  // set to greater/lesser respects aspect ratios
                  // set to greater/lesser will override set to width and set to height
                  s2w = s2g ? width >= height : height > width;
                  // if set to height, reset width
                  setW = s2w ? w || h : width;
                  s2h = !s2w;
                  // if set to width, reset height
                  setW = s2h ? h || w : height;
                }

                if (s2w) {
                  difw = setW / width;
                }
                if (s2h) {
                  difh = setH / height;
                }
                layers[1].width = setW * difh;
                layers[1].height = setH * difw;
              } else {
                // Scale to Image (Display Image at its native res)
                layers[1].width = width;
                layers[1].height = height;
              }

              if (spinner) layers[0].height = layers[1].height;

              ctx.drawImage(img, 0, 0, ...[layers[1].width, layers[1].height]);

              spinning = false;
              if (skroll) scrollit();
              cb.run('slidd');
            },
        offload =
            img => {
              let siz = [img.width, img.height], vimg = iimg[img.virID], storeImgbit = imgbit => {
                if (vimg) vimg.ib = imgbit;
                if (img.master) draw(imgbit);
              };

              if (!img.ui) {
                off.clearRect(0, 0, layers[2].width, layers[2].height);
                layers[2].width = siz[0];
                layers[2].height = siz[1];
                off.drawImage(img, 0, 0);
                try {
                  vimg.ui = off.getImageData(0, 0, ...siz);
                } catch (e) {
                  console.log('Cannot get imageData from cross-origin');
                  let ib = layers[2].transferToImageBitmap();
                  return storeImgbit(ib);
                }
              } else {
                vimg = img;
              }
              // Does not work with CORS, limited to Electron for now (new
              // BrowserWindow({webPreferences: {webSecurity: false}});)
              if (gpu) {
                const shader = config.shader ||
                    function(data) {
                      var x = this.thread.x;
                      var y = this.thread.y;
                      var n = 4 * (x + this.constants.w * (this.constants.h - y));

                      var red = data[n] / 256;
                      var green = data[n + 1] / 256;
                      var blue = data[n + 2] / 256;
                      var alpha = data[n + 3] / 256;

                      this.color(red, green, blue, alpha);
                    },
                      // the kernel runs for each pixel, with:
                      // - this.thread.x = horizontal position in pixels from
                      // the left edge
                      // - this.thread.y = vertical position in pixels from the
                      // bottom edge (*opposite of canvas*)
                    render = gpu.createKernel(shader)
                                 .setConstants({w: siz[0], h: siz[1]})
                                 .setOutput(siz)
                                 .setGraphical(true);

                // RESET canvas to deal with bug
                render.canvas.width = 1;
                render.canvas.height = 1;
                render.maxTexSize = [1, 1];
                render(vimg.ui.data);
                createImageBitmap(render.canvas).then(storeImgbit);
              } else {
                let pixelfn = config.pixelfn;
                createImageBitmap((pixelfn) ? pixelfn(vimg.ui) : vimg.ui).then(storeImgbit);
              }
            },
        assign =
            idd => {
              /**
               * iimg = {
               *  s: (image source url),
               *  d: (image order: -1 = first, 0 = mid, 1 = last),
               *  ui: (imageData Uint8ClampedArray),
               *  ib: (imageBitmap drawn image)
               * }
               */
              if (!iimg.length) return;
              spinning = true;
              raf(spin);
              cb.run('start');
              // clamp between 0 and iimg len
              idd = Math.min(Math.max(0, idd), iimg.length - 1);
              // if not loaded, clear top layer to show spinner
              if (!iimg[idd].ib) {
                ctx.clearRect(0, 0, layers[1].width, layers[1].height);
                master.virID = idd;
                master.src = options.dir + iimg[idd].s;
              } else {
                if (iimg[idd].st != iimg.shaderTime) {
                  offload(iimg[idd]);
                } else {
                  draw(iimg[idd].ib);
                }
              }
              current = idd;

              let q, r = 0;
              for (q = idd - 1; (r < options.irb) && (q >= 0); q--) {
                if (iimg[q].ib)
                  continue;
                else if (iimg[q].st != iimg.shaderTime) {
                  offload(iimg[q]);
                  continue;
                }
                setPreload(r, q, options.dir + iimg[q].s);
                r++;
              }
              for (q = idd + 1; (r < options.itb) && (q < iimg.length); q++) {
                if (iimg[q].ib)
                  continue;
                else if (iimg[q].st != iimg.shaderTime) {
                  offload(iimg[q]);
                  continue;
                }
                setPreload(r, q, options.dir + iimg[q].s);
                r++;
              }
            },
        xtndLmt =
            (org, src) => {
              // add value from src if its key exists in org
              if (!org) return;
              for (var key in src)
                if (org.hasOwnProperty(key)) org[key] = src[key];
            },
        setupLoader = count => Array(count).fill(1).map((e, i) => {
          let img = new Image();
          img.unique = i;
          img.virID = -1;
          img.addEventListener('load', offload.bind(null, img));
          return img;
        }),
        format_iimg =
            raw => {
              let st = Date.now(),
                  form = ((typeof raw == 'string') ? raw.split(' ') : raw)
                             .map(
                                 (v, i, a) =>
                                     ({s: v, st: st, d: (i ? (i == a.length - 1 ? 1 : 0) : -1)}));
              form.shaderTime = st;
              return form;
            },
        setPreload =
            (pid, id, src) => {
              preload[pid].virID = id;
              preload[pid].src = src;
            },
        jq =
            () => {
              try {
                jQuery.fn.direction = function(a, c) {
                  return this.each(function() {
                    c.anchor = $(this);
                    d(a, c);
                  });
                };
              } catch (e) {
                console.log(e);
              }
            },
        // GLOBAL shortcuts
      du = document, db = du.body, de = du.documentElement, pi = parseInt,
        raf = window.requestAnimationFrame;
  // PROPERTIES - private
  let owrite = config.overwrite || 0, anchor = config.anchor || db, iimg = format_iimg(input),
      // is the spinner spinning?
      spinning = true,
      // scroll ID
      scrolling = -1,
      //-1 for unset, corresponds to current page
      current = -1, layers = {
        0: config.disableSpin ? null : du.createElement('canvas'),
        1: du.createElement('canvas'),
        2: new OffscreenCanvas(dim[0], dim[1])
      },
      spinner = layers[0] ? {
        ctx: layers[0].getContext('2d'),
        clr: config.color || '#373737',
        str: Date.now(),
        lne: config.lines || 16,
        rte: config.rate || 1000 / 30,
        dia: config.diameter || 250,
        lbk: config.loaderback || '#FFF',
        dat: Date.now(),
        sav: []
      } :
                            null,
      options = {
        dir: config.dir || '',
        irb: config.imgprebuffer || 5,
        itb: config.imgpostbuffer || 5,
        bck: config.back || '#FFF',
        sz: config.size || 0,
      },
      // MASTER = directly draws, preload only request image
      preload = setupLoader(options.itb + options.irb), master = setupLoader(1)[0], skroll = true,
      ctx = layers[1].getContext('2d'), off = layers[2].getContext('2d'), cb = {
        run: a => {
          for (var b = 0; b < cb[a].length; b++) {
            cb[a][b]();
          }
        },
        start: [],
        slidn: [],
        slidd: []
      },
      gpu;

  // Library extensions
  if (window.jQuery) jq();
  // PROPERTIES - public
  this.canvi = layers;
  this.cb = cb;
  // METHODS - public
  // TODO: temp patch for shader setup
  this.setupShaders = (opts) => {
    if (opts.gpu) {
      const canvas = new OffscreenCanvas(dim[0], dim[1]),
            webGl = canvas.getContext('webgl2', {premultipliedAlpha: false});

      gpu = new opts.gpu({canvas, webGl});
    }
    if (opts.shader) config.shader = opts.shader;
    if (opts.pixelfn) config.pixelfn = opts.pixelfn;
  }, this.cnl = () => {
    // stop scrolling
    window.clearTimeout(scrolling);
  };
  this.swap = (arr, opts, start) => {
    iimg = Array.isArray(arr) ? format_iimg(arr) : iimg;
    if (opts) {
      xtndLmt(spinner, opts);
      xtndLmt(options, opts);
    }
    this.go(start || 0);
  };
  this.count = () => {
    return iimg.length;
  };
  this.current = () => {
    return current;
  };
  this.callback = (type, callback, index, remove) => {
    if (type === null || void 0 === type) return cb.slidn;
    var typeMap = {'-1': cb.start, '0': cb.slidn, '1': cb.slidd}, select = typeMap[index || 0];

    if (remove) {
      return select.splice(index || select.length - 1, 1);
    }

    if (callback === null || void 0 === callback) {
      return index === null || void 0 === index ? select : select[index];
    }

    if (index === null || void 0 === index) {
      select.push(callback);
    } else
      select[index] = callback;

    return 1;
  };
  this.go = (to) => {
    var sre = to === null || void 0 === to ? 0 : pi(to, 10);
    // console.log(sre);
    sre = isNaN(sre) ? 0 : sre;
    assign(Math.floor(Math.max(0, Math.min(iimg.length - 1, sre))));
    return sre;
  };
  this.prev = () => {
    var sre = current - 1;  // avoids possible race condition, assign loads in new image which
                            // can call draw which can change self.current before it gets to the
                            // return call. storing it premptively will preserve the value
    if (sre >= 0) assign(sre);
    return sre;
  };
  this.next = () => {
    // console.log("Hello");
    var sre = current + 1;
    if (sre < iimg.length) assign(sre);
    return sre;
  };
  this.frst = () => {
    if (current >= 0) assign(0);
    return 0;
  };
  this.last = () => {
    assign(iimg.length - 1);
    return iimg.length - 1;
  };
  this.rand = () => {
    var sre = Math.floor(Math.random() * (iimg.length - 1));
    // console.log(sre);
    assign(sre);
    return sre;
  };
  this.data = (to) => {
    // returns info about slide
    var sre = to === null || void 0 === to ? current : pi(to, 10);
    return isNaN(sre) ? iimg[current] :
                        iimg[Math.floor(Math.max(0, Math.min(iimg.length - 1, sre)))];
  };
  this.scroll = (bool) => {
    // toggles Auto Scrolling
    if (!(bool === null || void 0 === bool)) skroll = bool;
    return skroll;
  };
  this.scrollTo = (to, time) => {
    return scrollit(to, time);
  };  // public wrapper for scrollit
  this.resize = (sz, redraw = true, defaultDimensions = false) => {
    options.sz = defaultDimensions ? {...sz, w: dim[0], h: dim[1]} : sz;
    if (redraw) {
      this.go(current);
    }
    return sz;
  };

  if (spinner) {
    // LOADER - setup
    layers[0].height = 480;
    layers[0].style.background = spinner.lbk;
    layers[0].style.paddingLeft = '170px';
    layers[0].style.zIndex = 0;
    layers[0].style.position = 'absolute';
    anchor.appendChild(layers[0]);
  }

  if (options.sz) {
    let {
      w,
      h,
      width,
      height,
      sh,
      sw,
      sg,
      sl,
      s2h,
      s2w,
      s2g,
      s2l,
      scaleToHeight,
      scaleToWidth,
      scaleToGreater,
      scaleToLesser
    } = options.sz;
    options.sz = {
      w: w || width,
      h: h || height,
      s2w: sw || s2w || scaleToWidth,
      s2h: sh || s2h || scaleToHeight,
      s2g: sg || s2g || scaleToGreater,
      s2l: sl || s2l || scaleToLesser
    }
  }

  // init
  master.master = true;
  master.unique = -1;
  assign(options.startpage || owrite);
  // end init
  layers[1].height = dim[0];
  layers[1].width = dim[1];
  layers[1].background = options.bck;
  layers[1].style.zIndex = 1;
  layers[1].style.position = 'relative';
  // layers[1].style.visibility="hidden";
  // if (anchor) anchor.appendChild(layers[1]);
  // else du.body.appendChild(layers[1]);
  anchor.appendChild(layers[1]);
};