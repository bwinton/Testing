var BufferedReader = require('buffered-reader');
var browserid = require('express-browserid');
var ejs = require('ejs');
var express = require('express');
var fs = require('fs');
var mongo = require('mongojs');
var MongoStore = require('connect-mongodb');

var app = express.createServer(express.logger());

var collections = ["files"];
var db = mongo.connect(process.env.MONGODB_URL || "test", collections);

var headings = [
  {title:"UI-Reviewers", key:"ui-reviewers"},
  {title:"Reviewers", key:"reviewers"},
  {title:"Super-Reviewers", key:"super-reviewers"}
];

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  var store = new MongoStore({db:db.client});
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
    data = {};
    db.files.group([], {name: {$in:matches}}, {}, function(obj, prev){
      for (key in obj) {
        prev[key] = obj[key];
      }
    }, function(err, files) {
      data = {"reviewers": [], "ui-reviewers": [], "super-reviewers": [] };
      if (err) throw err;
      if (!files || !files.length) console.log("No files found");
      else {
        files = files[0];
        for (key in data) {
          for (person in files[key]) {
            data[key].push({person: person, count:files[key][person]});            
          }
          data[key] = data[key].sort(function(a,b){return b.count - a.count});
        }
      }
      res.render("results.html", {"headings":headings, "data": data});
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

  new BufferedReader(data_path, {encoding: "utf8"}).on("error", function(error){
      console.log(error);
  }).on("line", function(line){
    data = JSON.parse(line);
    // Update the mongo record here.
    db.files.insert(data, function(err, saved) {
     if (err) throw err;
     if (!saved) console.log("File "+data.name+" not updated");
   });
  }).on("end", function (){
    console.log("EOF for "+data_path);
    // delete the temp file.
    fs.unlink(data_path, function(err) {
      if (err) throw err;
    });
  }).read();
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on http://localhost:" + port + "/");
});