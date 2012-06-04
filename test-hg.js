var hg = require("./hg-cmd").create({debug:false});

var next = function(obj) {
  hg.runcommand("summary");
  next = function (obj) {
    next = false;
  };
};

function callback(err, obj) {
  if (err) {
    console.log("Err = "+err+"!!!");
    throw err;
  }

  console.log("Value = "+obj.channel + " " + obj.value);
  if (next)
    next(obj);
  else
    hg.disconnect();
};

var server = hg.connect("testdata/comm-central", callback);
