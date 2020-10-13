// need to work out banning partners
// need to work out blocking partners
// consider refactoring prep for pairing users
// consider
// storing names in local storage
// tested out multiple users at the same time -- refactored code a bit see if it still works

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
  //make sure users are still active
  if(currentUsers.indexOf(user1) === -1){
    pairUsers(user2);
    return;
  }
  if(currentUsers.indexOf(user2) === -1){
    pairUsers(user1);
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
  user1.sendUTF(JSON.stringify(matchMsg));
  user2.sendUTF(JSON.stringify(matchMsg));

  // var videoMatchMsg ={
  //   type:"video-match",
  //   id: user1,
  //   target: user2
  // }
  // user1.sendUTF(JSON.stringify(videoMatchMsg));
}

function checkInWaitingConn(connection){
  setTimeout(()=>{
    console.log('connection.currentPartner from checkInWaitingConn', connection.currentPartner)
    if(connection.currentPartner === ''){
      connection.noNewMatches = true;
      pairUsers(connection);
    }
  },3000);
}

//pair users
function pairUsers(connection){
  if(connection.blocksReceived.length > 1){
    var bannedMsg = {
      type:"banned"
    }
    connection.sendUTF(JSON.stringify(bannedMsg));
    return
  }
  var matchingMsg= {
    type:"matching"
  }
  connection.sendUTF(JSON.stringify(matchingMsg));

//check if user already in waitingList, if not then add
  if(!connection.noNewMatches){
    waitingList = [...waitingList, connection];
  }

  if(waitingList.length < 1) return;

  var partner;
  var prevMatchedIndices = []
  // try to find a new partner
  // think about putting the noNewMatches and this together
  waitingList.forEach(function loop(user, i){
    if(loop.stop) return;

    if(user.userId === connection.userId) return;

    if(connection.blocksGiven.indexOf(user.userId) !== -1) return;

    if(user.blocksGiven.indexOf(connection.userId) !== -1) return;

    if(connection.prevMatched.indexOf(user.userId) !== -1) return prevMatchedIndices.push(connection.prevMatched.indexOf(user.userId));

    if(connection.prevMatched.indexOf(user.userId) === -1 && connection.currentPartner === '' && user.currentPartner === ''){
      connection.noNewMatches = false;
      partner = user;
      loop.stop = true;
    }
  });
  //if can't find new partner and not on the first pairing or repairing, use a previously matched partner
  if(!partner && connection.noNewMatches === true && connection.currentPartner === ''){
    //get the prev matched partner with the min index
    var matchMinIndex = Math.min(...prevMatchedIndices);
    var partnerId = connection.prevMatched.filter((prevMatch, i)=> i === matchMinIndex)[0];
    //remove from previously matched so next time the partner will have a higher index
    connection.prevMatched = connection.prevMatched.filter((prevMatch, i)=> i !== matchMinIndex)
    waitingList.forEach( (user,i)=>{
      if(user.userId === partnerId){
        partner = user;
        user.prevMatched = user.prevMatched.filter((prevMatch)=> prevMatch !== connection.userId)
      }
    })
  }
  //if a partner was found match, else put in waiting
  if(!partner){
    checkInWaitingConn(connection);
  }else{
    waitingList = waitingList.filter(human => human.userId !== connection.userId && human.userId !== partner.userId);
    connect(connection, partner);
  }
}

// Sends a message (which is already stringified JSON) to a single
// user, given their userID. We use this for the WebRTC signaling,
function sendToOneUser(target, msgString) {
  currentUsers.forEach((partner) => {
    console.log('userId ', partner.userId)
    if (partner.userId === target) {
      partner.sendUTF(msgString);
    }
  });
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
  connection.blocksGiven = [];
  connection.blocksReceived = [];
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
        case "block":
        // will have to change userId to ip address or mobile device
        currentUsers.forEach((human, i) => {
          if(human.userId === msg.userId){
            human.currentPartner = '';
            human.blocksGiven = [...human.blocksGiven, msg.partnerId];
            pairUsers(human);
          }
          if(human.userId === msg.partnerId){
            human.currentPartner = '';
            human.blocksReceived = [...human.blocksReceived, msg.userId];
            pairUsers(human);
          }
        });
        break;
      }
      if (msg.target && msg.target !== undefined && msg.target.length !== 0) {
        var msgString = JSON.stringify(msg);
        sendToOneUser(msg.target, msgString);
      }
    }
  });//connection on message

// Handle the WebSocket "close" event; this means a user has logged off
// or has been disconnected.
connection.on('close', function(reason, description) {

    // get abandonedPartner back in the game
    currentUsers.forEach((human, i) => {
      if(human.userId === connection.currentPartner){
        var hangUpMsg = {
          type:"hang-up"
        }
        human.sendUTF(JSON.stringify(hangUpMsg))
        human.currentPartner = '';
        pairUsers(human);
      }
    });

    // Remove the connection from the list of connections.
    currentUsers = currentUsers.filter(function(el, idx) {
      if(el.connected) return el.connected;
    });

  // Build and output log output for close information.
  var logMessage = "Connection closed: " + connection.remoteAddress + " (" + reason;
  if (description !== null && description.length !== 0) {
    logMessage += ": " + description;
  }
  logMessage += ")";
  console.log(logMessage);
 });
});
