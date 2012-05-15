var browserid = require("express-browserid");
var ejs = require("ejs");
var express = require("express");
var fs = require("fs");
var redis = require("redis-url").connect(process.env.REDISTOGO_URL);
var RedisStore = require('connect-redis')(express);

redis.set("foo", "bar");

var app = express.createServer(express.logger());

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: process.env.SESSION_SECRET || "horse ebooks",
    store: new RedisStore({client:redis})}));
  app.use(app.router);
  app.use(express.static(__dirname + "/public"));
  app.set("views", __dirname + "/templates/");
  app.set("view options", {layout: false});
  app.register(".html", ejs);
  browserid.plugAll(app);
});

app.get("/", function(req, res) {
  redis.smembers('repos', function(err, value) {
    res.render("index.html",
               {"email": req.session.email,
                "repos": value});
  });
});

app.post("/patch", function(req, res) {
  var data_path = req.files.patch.path;
  var name = req.body.name;
  fs.readFile(data_path, function(err, contents) {
    if (err) throw err;
    // delete the temp file
    fs.unlink(data_path, function(err) {
      if (err) throw err;
    });
    var fileRe = /^\+\+\+ (b\/)?([^\s]*)/mg
    var matches = (""+contents).match(fileRe);
    var getKeys = redis.multi();

    for (var i in matches) {
      match = matches[i].replace(/^\+\+\+ (b\/)?/, "");
      getKeys.keys(name + ":" + match + ":*");
    }
    getKeys.exec(function(err, replies) {
      keys = []
      for (var i in replies) {
        keys = keys.concat(replies[i]);
      }
      var getPeople = redis.multi();
      for (var i in keys) {
        getPeople.zrevrange(keys[i], 0, -1, "WITHSCORES");
      }
      getPeople.exec(function(err, replies) {
        data = {};
        for (var i in replies) {
          var key = keys[i].split(":");
          var reply = replies[i];
          var sum = data[key[2]];
          if (!sum) {
            sum = {};
            data[key[2]] = sum;
          }
          while (reply.length) {
            var person = reply.shift();
            var score = reply.shift();
            if (!sum[person])
              sum[person] = score;
            else
              sum[person] += score;
          }
        }
        var all = []
        for (var i in data) {
          var x = [];
          for (var j in data[i]) {
            x.push([data[i][j], j]);
          }
          all.push([i, x.sort(function(a, b) {
            return b[0] - a[0];
          })]);
        }
        all.sort();
        res.render("results.html", {"all": all});
      })
    });
  });
});

app.get("/update", function(req, res) {
  if (req.session.email != "bwinton@mozilla.com") {
    res.send("Silly rabbit, Trix are for kids…");
    return
  }
  res.render("upload.html", {});
});

app.post("/update", function(req, res) {
  res.send("Thanks!");
  redis.sadd("repos", req.body.name);
  var data_path = req.files.data.path;
  fs.readFile(data_path, function(err, contents) {
    if (err) throw err;
    // delete the temp file
    fs.unlink(data_path, function(err) {
      if (err) throw err;
    });
    data = JSON.parse(contents);
    for (var key in data) {
      for (var field in data[key]) {
        for (var person in data[key][field]) {
          redis.zadd(req.body.name + ":" + key + ":" + field, data[key][field][person], person)
        }
      }
    };
  });

});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on http://localhost:" + port + "/");
});