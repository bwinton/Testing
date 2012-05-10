var express = require('express');
var redis = require('redis-url').connect(process.env.REDISTOGO_URL);

redis.set('foo', 'bar');

var app = express.createServer(express.logger());

app.get('/', function(request, response) {
  redis.get('foo', function(err, value) {
    response.send('Hello World!<br>foo is: ' + value);
  });
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
