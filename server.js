var BufferedReader = require('buffered-reader');
var browserid = require('express-browserid');
var ejs = require('ejs');
var express = require('express');
var fs = require('fs');
var mongo = require('mongojs');
var MongoStore = require('connect-mongodb');

var app = express.createServer(express.logger());

/* {
  "VCAP_APP_HOST":"10.22.112.136",
  "VCAP_APP_PORT":"41201",
  "VCAP_APPLICATION":"{\"instance_id\":\"94456182bfd8b117ad47015f6993391d\",\"instance_index\":0,\"name\":\"reviewers\",\"uris\":[\"reviewers.vcap.mozillalabs.com\"],\"users\":[\"bwinton@mozilla.com\"],\"version\":\"2a547782f73f8be4e01ae716ea8ae5ec2893c42c-1\",\"start\":\"2012-06-26 11:14:20 -0700\",\"runtime\":\"node\",\"state_timestamp\":1340734460,\"port\":41201,\"limits\":{\"fds\":256,\"mem\":67108864,\"disk\":2147483648},\"host\":\"10.22.112.136\"}",
  "VCAP_DEBUG_IP":"",
  "VCAP_DEBUG_PORT":"",
  "VCAP_SERVICES":"{\"mongodb-1.8\":[{\"name\":\"reviewers-mongo\",\"label\":\"mongodb-1.8\",\"plan\":\"free\",\"tags\":[\"mongodb\",\"mongodb-1.6\",\"nosql\"],\"credentials\":{\"hostname\":\"10.22.112.137\",\"host\":\"10.22.112.137\",\"port\":25004,\"username\":\"68e21404-8e9c-4923-941f-9ce31ca713cd\",\"password\":\"7d8b7f6b-45e4-46c3-bad3-fb65f11a5945\",\"name\":\"2a999aaf-ec17-4ef5-bfa9-c45e3f0454c8\",\"db\":\"db\"}}]}",
  "VMC_APP_HOST":"10.22.112.136",
  "VMC_APP_ID":"94456182bfd8b117ad47015f6993391d",
  "VMC_APP_INSTANCE":"{\"droplet_id\":132,\"instance_id\":\"94456182bfd8b117ad47015f6993391d\",\"instance_index\":0,\"name\":\"reviewers\",\"dir\":\"/var/vcap.local/dea/apps/reviewers-0-94456182bfd8b117ad47015f6993391d\",\"uris\":[\"reviewers.vcap.mozillalabs.com\"],\"users\":[\"bwinton@mozilla.com\"],\"version\":\"2a547782f73f8be4e01ae716ea8ae5ec2893c42c-1\",\"mem_quota\":67108864,\"disk_quota\":2147483648,\"fds_quota\":256,\"state\":\"STARTING\",\"runtime\":\"node\",\"framework\":\"node\",\"start\":\"2012-06-26 11:14:20 -0700\",\"state_timestamp\":1340734460,\"log_id\":\"(name=reviewers app_id=132 instance=94456182bfd8b117ad47015f6993391d index=0)\",\"resources_tracked\":true,\"port\":41201}",
  "VMC_APP_NAME":"reviewers",
  "VMC_APP_PORT":"41201",
  "VMC_APP_VERSION":"2a547782f73f8be4e01ae716ea8ae5ec2893c42c-1",
  "VMC_MONGODB":"10.22.112.137:25004",
  "VMC_SERVICES":"[{\"name\":\"reviewers-mongo\",\"type\":\"key-value\",\"vendor\":\"mongodb\",\"version\":\"1.8\",\"tier\":\"free\",\"options\":{\"hostname\":\"10.22.112.137\",\"host\":\"10.22.112.137\",\"port\":25004,\"username\":\"68e21404-8e9c-4923-941f-9ce31ca713cd\",\"password\":\"7d8b7f6b-45e4-46c3-bad3-fb65f11a5945\",\"name\":\"2a999aaf-ec17-4ef5-bfa9-c45e3f0454c8\",\"db\":\"db\"}}]",
  "VMC_WARNING_WARNING":"All VMC_* environment variables are deprecated, please use VCAP_* versions.",
} */


var services = JSON.parse(process.env.VCAP_SERVICES);
var mongo_data = services["mongodb-1.8"][0].credentials;
var mongo_url = "mongodb://" + mongo_data.username + ":" + mongo_data.password +
                "@" + mongo_data.host + ":" + mongo_data.port + "/" + mongo_data.db;

var collections = ["files"];
var db = mongo.connect(mongo_url, collections);

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

const PORT = process.env.PORT || process.env.VCAP_APP_PORT || 3000;
const HOST = process.env.IP_ADDRESS || process.env.VCAP_APP_HOST || '127.0.0.1';

app.listen(PORT, HOST, function() {
  console.log("Listening on http://" + HOST + ":" + PORT + "/");
});