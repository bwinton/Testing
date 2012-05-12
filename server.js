var express = require("express");
var redis = require("redis-url").connect(process.env.REDISTOGO_URL);
var RedisStore = require('connect-redis')(express);
var browserid = require("express-browserid");
var ejs = require("ejs");


redis.set("foo", "bar");

var app = express.createServer(express.logger());

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: process.env.SESSION_SECRET,
    store: new RedisStore({client:redis})}));
  app.use(app.router);
  app.use(express.static(__dirname + "/public"));
  app.set("views", __dirname + "/templates/");
  app.set("view options", {layout: false});
  app.register(".html", ejs);
  browserid.plugAll(app);
});

app.get('/', function(req, res) {
  redis.get('foo', function(err, value) {
    res.render("index.html",
               {"email": req.session.email,
                "value": value});
  });
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on http://localhost:" + port + "/");
});