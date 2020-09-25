// need to work out banning partners
// need to work out blocking partners
// storing names in local host
// tested out multiple users at the same time -- looking good so far!!
// future problems
// find a way to protect myself from bots

// current Problems
// it's possible for users to get stuck on a certain pairing - it was and I fixed it!!!
// it's possible for a matching to take place during another matching ** figure out why! - not getting that problem I think it was because find-new-partner was being called twice

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
  //remove users from waitingList
  waitingList = waitingList.filter(human => human.userId !== user1.userId && human.userId !== user2.userId);
  //make sure users are still active
  console.log('hello from connect, here is waitingList', waitingList)
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
    type:"matched",
    user1:{
      id: user1.userId,
      username: user1.username,
      prevMatched: user1.prevMatched

    },
    user2:{
      id: user2.userId,
      username: user2.username,
      prevMatched: user2.prevMatched
    }
  }
  var stringyMatchMsg = JSON.stringify(matchMsg);
  user1.sendUTF(stringyMatchMsg);
  user2.sendUTF(stringyMatchMsg);
  console.log('hello from connect', matchMsg.user1, matchMsg.user2)
}

function checkInWaitingConn(connection){
  setTimeout(()=>{
    if(connection.currentPartner === ''){
      connection.noNewMatches = true;
      pairUsers(connection);
    }
  },3000);
}

function reEnterPairing(connection){
  console.log('moved into reEnterPairing ', connection.userId);
  setTimeout(function(){
    pairUsers(connection);
  }, 2500);
}

//pair users
function pairUsers(connection){
  var matchingMsg= {
    type:"matching"
  }
  var stringyMatchingMsg = JSON.stringify(matchingMsg);
  connection.sendUTF(stringyMatchingMsg);

  if(!connection.noNewMatches){
    waitingList = [...waitingList, connection];
  }
  if(waitingList.length < 1){
    return;
  }
  var partner;
  waitingList.forEach(function loop(user, i){
    if(loop.stop){
      return;
    }
    if(user.userId === connection.userId){
      return;
    }
    if(connection.prevMatched.indexOf(user.userId) === -1 && connection.currentPartner === '' && user.currentPartner === ''){
      console.log('hello from not previously matched waitingList' );
      connection.noNewMatches === false;
      partner = user;
      loop.stop = true;
    }
  });
  if(connection.noNewMatches === true && connection.currentPartner === ''){
    if(waitingList.length === 1){
      waitingList.forEach((user) => {
        if(user.userId !== connection.userId){
          partner = user;
        }
      });
    }
    if(waitingList.length > 1){
      var prevMatchedIndices = []
      waitingList.forEach((user, i) => {
        if(connection.prevMatched.indexOf(user.userId) !== -1 && user.currentPartner === ''){
          prevMatchedIndices.push(connection.prevMatched.indexOf(user.userId))
        }
      });
      //get the partner with the min index
      var matchMinIndex = Math.min(...prevMatchedIndices);
      var partnerId = connection.prevMatched.filter((prevMatch, i)=> i === matchMinIndex)[0];
      //remove from previously matched so next time the partner will have a higher index
      connection.prevMatched = connection.prevMatched.filter((prevMatch, i)=> i !== matchMinIndex)
      waitingList.forEach( (user,i)=>{
        if(user.userId === partnerId){
          partner = user;
        }
      })
    }
    if(partner){
      waitingList.forEach( (user,i)=>{
        if(user.userId === partnerId){
          user.prevMatched = user.prevMatched.filter((prevMatch, i)=> prevMatch !== connection.userId)
        }
      })
    }
  }
  if(!partner){
    checkInWaitingConn(connection);
  }else{
    waitingList = waitingList.filter(human => human.userId !== connection.userId && human.userId !== partner.userId);
    connect(connection, partner);
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
  console.log("ERROR: Unable to create WebSocket server!");
}

//New user trying to connect to server
wsServer.on('request', function(request) {

  //will need this for blocked users
  if (!originIsAllowed(request.origin)) {
    request.reject();
    console.log("Connection from " + request.origin + " rejected.");
    return;
  }

  // Accept the request and get a connection.

  var connection = request.accept("json", request.origin);
  console.log("Connection accepted from " + connection.remoteAddress + ".");

  connection.matched = false;
  connection.userId = nextID;
  var idMsg = {
    type:"id",
    id: connection.userId
  }
  var stringyIdMsg = JSON.stringify(idMsg);
  connection.sendUTF(stringyIdMsg);
  connection.prevMatched = [];
  connection.currentPartner = '';
  connection.noNewMatches = false;
  currentUsers.push(connection);
  userIds.push(connection.userId)

  console.log("client id from array " + userIds);

  nextID++;


  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log("Received Message: " + message.utf8Data);

      // Process incoming data.
      var msg = JSON.parse(message.utf8Data);
      //var connect = getConnectionForID(msg.id);

      // Take a look at the incoming object and act on it based
      // on its type. Unknown message types are passed through,
      // since they may be used to implement client-side features.
      // Messages with a "target" property are sent only to a user
      // by that name.

      switch(msg.type) {
        case "username":
        //sanitize username with this
        msg.text = msg.text.replace(/(<([^>]+)>)/ig, "");
        connection.username = msg.text;
        //make a name checker for blocked words
        pairUsers(connection);
        break;
        case "find-new-parnter":
        currentUsers.forEach((human, i) => {
          if(human.userId === connection.userId){
            human.currentPartner = '';
            pairUsers(human);
          }
        });
        break;
        case "hang-up":
        // this means they need to be put back into pairUsers function if they still have a connection
        // they also need to have to have no currentPartner
        // by hanging up the person no longer wants to zengreet so they get taken to the thank you page
        // the other person we need to make
        msg.name = connect.username;
        msg.target
        msg.text = msg.text.replace(/(<([^>]+)>)/ig, "");
        break;

      }
    }
  });//connection on message

// Handle the WebSocket "close" event; this means a user has logged off
// or has been disconnected.
connection.on('close', function(reason, description) {

    // get abandonedPartner back in the game
    currentUsers.forEach((human, i) => {
      if(human.userId === connection.currentPartner){
        human.currentPartner = '';
        pairUsers(human);
      }
    });

    // First, remove the connection from the list of connections.
    currentUsers = currentUsers.filter(function(el, idx) {
      if(el.connected){
        return el.connected;
      }
    });

    console.log('currentUsers length', currentUsers)

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
