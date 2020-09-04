
"use strict";
var express = require('express');
var PORT = process.env.PORT || 4500;
var WebSocketServer = require('websocket').server;
//Express server set up
var app = express ();
//cli: nodemon index.js
var server = app.listen(PORT, function(){
  console.log('listening on *:4500');
});

// connecting to the static files
app.use(express.static('public'));

var nextID = Date.now();
var waitingList = [];
var userIds = [];

//create conditions for blocking users here
function originIsAllowed(origin) {
  return true;
}

// Create the WebSocket server by converting the HTTPS server into one.
var wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

if (!wsServer) {
  log("ERROR: Unable to create WebSocket server!");
}

//New user trying to connect to server
wsServer.on('request', function(request) {

  //will need this for blocked users
  if (!originIsAllowed(request.origin)) {
    request.reject();
    log("Connection from " + request.origin + " rejected.");
    return;
  }

  // Accept the request and get a connection.

  var connection = request.accept("json", request.origin);
  console.log("Connection accepted from " + connection.remoteAddress + ".");

  connection.matched = false;
  connection.clientID = nextID;
  waitingList.push(connection);
  userIds.push(connection.clientID)

  console.log("client id from array " + userIds);

  nextID++;
});
