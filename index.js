
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
var currentUsers = [];
var waitingList = [];
var userIds = [];

function connect(user1, user2){
  //make sure users are still active
  if(currentUsers.indexOf(user1) === -1){
    pairUsers(user2);
    console.log('not in currentUsers user1')
    return;
  }
  if(currentUsers.indexOf(user2) === -1){
    pairUsers(user1);
    console.log('not in currentUsers user2' )
    return;
  }
  user1.prevMatched.push(user2.userId);
  user2.prevMatched.push(user1.userId);
  user1.currentPartner = user2.userId;
  user2.currentPartner = user1.userId;
  user1.noNewMatches = false;
  user2.noNewMatches = false;

  var matchMsg = {
    type:"match",
    user1: user1.userId,
    user2: user2.userId
  }
  var stringyMsg = JSON.stringify(matchMsg);
  user1.sendUTF(stringyMsg);
  user2.sendUTF(stringyMsg);
  console.log('hello from connect', matchMsg.user1, matchMsg.user2)
}

function reEnterPairing(connection){
  console.log('hello from not previously matched ');
  setTimeout(function(){
    pairUsers(connection);
  }, 1500);
}

//pair users
function pairUsers(connection){
  //might need to move currentPartner = '' to when disconnected
  connection.currentPartner = '';
  console.log('hello from pairUsers ', connection.userId);
  waitingList.push(connection);

  if(waitingList.length > 1){
    if(connection.noNewMatches === true && connection.currentPartner !== ''){
      waitingList = waitingList.filter(human => human.userId !== connection.userId)
      var partner = waitingList.shift();
      connect(connection, partner)
    }
    waitingList.forEach(function loop(user, i){
      if(loop.stop){
        return;
      }
      if(user.userId === connection.userId){
        return;
      }
      if(connection.prevMatched.indexOf(user) == -1 && connection.currentPartner !== '' && user.currentPartner !== ''){
        console.log('hello from not previously matched ');
        connect(connection, user);
        waitingList = waitingList.filter(human => human.userId !== user.userId || human.userId !== connection.userId);
        loop.stop = true;
        return;
      }
      connection.noNewMatches = true;
      waitingList = waitingList.filter(human => human.userId !== connection.userId);
      reEnterPairing(connection);

    });

  }

}

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
  connection.userId = nextID;
  connection.prevMatched = [];
  connection.currentPartner = '';
  connection.noNewMatches = false;
  currentUsers.push(connection);
  userIds.push(connection.userId)

  console.log("client id from array " + userIds);

  nextID++;
  pairUsers(connection);


  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      log("Received Message: " + message.utf8Data);

      // Process incoming data.
      var msg = JSON.parse(message.utf8Data);
      var connect = getConnectionForID(msg.id);

      // Take a look at the incoming object and act on it based
      // on its type. Unknown message types are passed through,
      // since they may be used to implement client-side features.
      // Messages with a "target" property are sent only to a user
      // by that name.

      switch(msg.type) {
        case "username":
        //sanitize username with this
        msg.text = msg.text.replace(/(<([^>]+)>)/ig, "");
        break;
        case "hang-up":
        //this means they need to be put back into pairUsers function if they still have a connection
        //they also need to have to have no currentPartner
        msg.name = connect.username;
        msg.text = msg.text.replace(/(<([^>]+)>)/ig, "");
        break;

      }
    }
  });//connection on message 

// Handle the WebSocket "close" event; this means a user has logged off
// or has been disconnected.
connection.on('close', function(reason, description) {
  // First, remove the connection from the list of connections.
  currentUsers = currentUsers.filter(function(el, idx, ar) {
    return el.connected;
  });

  // get abandonedPartner back in the game
  currentUsers = currentUsers.map(human =>{
    if(human.clientId === connection.currentPartner)
      human.currentPartner = '';
      pairUsers(human);
  });

  // Build and output log output for close information.
  var logMessage = "Connection closed: " + connection.remoteAddress + " (" +
                   reason;
  if (description !== null && description.length !== 0) {
    logMessage += ": " + description;
  }
  logMessage += ")";
  console.log(logMessage);
 });
});
