var browserid = require('express-browserid');
var ejs = require('ejs');
var express = require('express');
var fs = require('fs');
var mongo = require('mongojs');
var MongoStore = require('connect-mongodb');

var app = express.createServer(express.logger());

var collections = ["files"];
var db = mongo.connect(process.env.MONGODB_URL, collections);

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  var store = new MongoStore({db:db.client});
  console.log(store);
  app.use(express.session({
    secret: process.env.SESSION_SECRET || "horse ebooks",
    store: store}));
  app.use(app.router);
  app.use(express.static(__dirname + "/public"));
  app.set("views", __dirname + "/templates/");
  app.set("view options", {layout: false});
  app.register(".html", ejs);
  browserid.plugAll(app);
});

app.get("/", function(req, res) {
  var email = req.session.email;
  res.render("index.html", {"email": email});
});

app.post("/patch", function(req, res) {
  var data_path = req.files.patch.path;
  fs.readFile(data_path, function(err, contents) {
    if (err) throw err;
    // delete the temp file
    fs.unlink(data_path, function(err) {
      if (err) throw err;
    });
    var fileRe = /^\+\+\+ (b\/)?([^\s]*)/mg
    var matches = (""+contents).match(fileRe);

    matches = matches.map(function(m) {
      return m.replace(/^\+\+\+ (b\/)?/, "");
    });
    console.log(matches);
    db.files.find({name: {$in:matches}}, function(err, files) {
      console.log(err, files);
      if (err) throw err;
      if (!files || !files.length) console.log("No files found");
      else files.forEach( function(file) {
        console.log(file);
      });
      res.render("results.html", {"all": files});
    });
  });
});

app.get("/update", function(req, res) {
  if (req.session.email != "bwinton@mozilla.com") {
    res.send("Silly rabbit, Trix are for kids…");
    return
  }
  res.render("upload.html", {"status":"initial"});
});

app.post("/update", function(req, res) {
  res.send("Thanks!");
  var data_path = req.files.data.path;
  fs.readFile(data_path, function(err, contents) {
    if (err) throw err;
    // delete the temp file.
    fs.unlink(data_path, function(err) {
      if (err) throw err;
    });
    data = JSON.parse(contents);
    for (var key in data) {
      var file = data[key];
      // Update the mongo record here.
      // db.files.save(file, function(err, saved) {
      // OR!!!
      // db.users.update({name: filename}, {$inc: {user: 1}}, function(err, updated) {
      //   if (err) throw err;
      //   if (!saved) console.log("File "+filename+" not updated");
      // });
    };
  });
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on http://localhost:" + port + "/");
});