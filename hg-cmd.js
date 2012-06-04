var jspack = require("jspack").jspack;
var path = require("path");
var process = require('child_process');
  

function HgCmd(params) {
  this.params = params;
}

HgCmd.prototype  = {
  connect: function hgcmd_connect(url, callback) {
    var self = this;
    this.dirname = path.basename(url);
    this.callback = callback;
    this.channel = "?";
    this.state = "header";
    this.remaining = 5;
    this.saved = new Buffer(this.remaining);
    if (self.params.debug)
      console.log(self);

    var clone = process.spawn("hg", ["clone", url]);
    clone.stdout.on("data", function(data) {
      if (self.params.debug)
        console.log(data.toString("utf8"));
    });
    clone.on("exit", function (code) {
      if (self.params.debug)
        console.log("Cloned " + url + " returned code " + code + ".");
      var update = process.spawn("hg", ["update", "null"]);
      update.stdout.on("data", function(data) {
        if (self.params.debug)
          console.log(data.toString("utf8"))
      });
      update.on("exit", function (code) {
        if (self.params.debug)
          console.log("Updating to null returned code " + code + ".  Spawning server.");
        self.server = process.spawn("hg",
          ["--config", "ui.interactive=True", "serve", "--cmdserver", "pipe"],
          {cwd: self.dirname})
        self.server.stdout.on("data", function(data) {self._readchannel(data)});
        self.server.on("exit", function (code) {
          if (self.params.debug)
            console.log("Server exited with code " + code);
        });
      });
    });
  },

  runcommand: function hgcmd_runcommand(command, params) {
    this.server.stdin.write("runcommand\n")
    if (!params)
      params = [];
    var data = params.slice(0);
    data.unshift(command);
    if (this.params.debug)
      console.log("Running '"+data.join(" ")+"'");
    this._writeblock(data.join("\0"));
  },

  disconnect: function hgcmd_disconnect() {
    if (this.params.debug)
      console.log("Ending.");
    this.server.stdin.end();
  },

  _readchannel: function hgcmd_readchannel(data) {
    if (this.params.debug) {
      console.log("In state "+this.state+", got data:");
      console.log(data);
    }
    var length = data.length;
    while (length > 0) {
      var toAdd = length;
      if (length > this.remaining)
        toAdd = this.remaining;
      if (this.params.debug)
        console.log("length="+length+", toAdd="+toAdd);
      data.copy(this.saved, this.saved.length - this.remaining, 0, toAdd);
      data = data.slice(toAdd);
      this.remaining -= toAdd;
      length -= toAdd;
      if (this.remaining == 0) {
        this.pumpstate()
      };
    };
  },

  _writeblock: function hgcmd_writeblock(data) {
    var length = new Buffer(jspack.Pack('>I', [data.length]));
    if (this.params.debug)
      console.log("Writing "+length);
    this.server.stdin.write(length);
      // wait for drain if write returns false.
    if (this.params.debug)
      console.log("Writing ");
    this.server.stdin.write(data);
      // wait for drain if write returns false.
    //this.server.stdin.flush();
  },

  pumpstate: function hgcmd_pumpstate() {
    if (this.state == "header") {
      var parsed = jspack.Unpack('>cI', this.saved)
      if (this.params.debug)
        console.log(parsed);
      this.channel = parsed[0];
      this.state = "waiting";
      this.remaining = parsed[1];
    } else if (this.state == "waiting") {
      this.callback(null, {channel:this.channel, value:this.saved});
      this.channel = "?";
      this.state = "header";
      this.remaining = 5;
    }
    this.saved = new Buffer(this.remaining);
  },

}

exports.create = function(params){return new HgCmd(params);};
