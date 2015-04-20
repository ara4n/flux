/**
 * This file is provided by Facebook for testing and evaluation purposes
 * only. Facebook reserves all rights not expressly granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * FACEBOOK BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
 * AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var ChatServerActionCreators = require('../actions/ChatServerActionCreators');

// !!! Please Note !!!
// We are using localStorage as an example, but in a real-world scenario, this
// would involve XMLHttpRequest, or perhaps a newer client-server protocol.
// The function signatures below might be similar to what you would build, but
// the contents of the functions are just trying to simulate client-server
// communication and server-side processing.

var sdk;
var client;
var homeserverUrl = "https://matrix.org";
var userId;
var roomName = {};
var fromToken;

function _calcRoomName(state) {
  // XXX: this should all be provided by the Server
  var members = [];
  var aliases = [];
  var roomName = null;
  for (var j = 0; j < state.length; j++) {
    var stateEvent = state[j];
    if (stateEvent.type === "m.room.name") {
      roomName = stateEvent.content.name;
    }
    if (stateEvent.type === "m.room.aliases") {
      aliases = stateEvent.content.aliases;
    }
    if (stateEvent.type === "m.room.member" && stateEvent.user_id != userId) {
      members.push(stateEvent.content.displayname || stateEvent.user_id);
    }
  }
    
  if (!roomName) {
    if (aliases.length) {
      roomName = aliases[0];
    }
    else {
      if (members.length == 1) {
        roomName = members[0];
      }
      else {
        roomName = members[0] + " and " + (members.length-1) + " others";
      }
    }
  }
  
  return roomName;
}

function _processEvents(events, echo, rawMessages) {
  for (var j = 0; j < events.length; j++) {
    var event = events[j];
    if (event.type !== "m.room.message") continue;
    if (!echo && event.user_id === userId) continue; // XXX: local echo hack
    if (!roomName[event.room_id]) roomName[event.room_id] = _calcRoomName(events);
    var message = {
      id: event.event_id,
      threadID: event.room_id,
      threadName: roomName[event.room_id],
      authorName: event.user_id,
      text: event.content.body,
      timestamp: event.origin_server_ts,
    };
    //console.log(JSON.stringify(message));
    rawMessages.push(message);
  }
}

function _pollForMessages() {
  client.eventStream(fromToken, 30000, function (err, data) {
    if (err) {
      console.error("err %s", JSON.stringify(err));
    }
    else {
      fromToken = data.end;
      var rawMessages = [];
      _processEvents(data.chunk, false, rawMessages);
      ChatServerActionCreators.receiveAll(rawMessages);
      _pollForMessages();
    }
  });
}  

module.exports = {

  init: function(callback) {
      sdk = require("matrix-js-sdk");
      sdk.request(require("browser-request"));    
      client = sdk.createClient(homeserverUrl);
      userId = prompt("Enter your matrix user id");
      var password = prompt("Enter your matrix password");
      client.loginWithPassword(userId, password, function(err, data) {
        if (err) {
          alert(JSON.stringify(err));
        }
        // XXX: surely we shouldn't have to do this?
        client.credentials.accessToken = data.access_token;
        client.credentials.userId = data.user_id;
        
        callback();
      });
  },
  
  getAllMessages: function() {
    var rawMessages = [];

    client.initialSync(12, function (err, data) {
      if (err) {
        console.error("err %s", JSON.stringify(err));
      }
      else {
        fromToken = data.end;
        for (var i = 0; i < data.rooms.length; i++) {
          roomName[data.rooms[i].room_id] = _calcRoomName(data.rooms[i].state);
          _processEvents(data.rooms[i].messages.chunk, true, rawMessages);
        }        
        ChatServerActionCreators.receiveAll(rawMessages);        

        _pollForMessages();
      }
    });
  },
  
  getUserId: function() {
    return userId;
  },
  
  createMessage: function(message) {
    // simulate writing to a database
    var timestamp = Date.now();
    var id = 'm_' + timestamp;
    var threadID = message.threadID || ('t_' + Date.now());
    var createdMessage = {
      id: id,
      threadID: threadID,
      threadName: roomName[threadID],
      authorName: message.authorName,
      text: message.text,
      timestamp: timestamp
    };
    
    client.sendTextMessage(threadID, message.text, function (err,data) {
      if (err) {
        console.error("err %s", JSON.stringify(err));
      }
    });

    ChatServerActionCreators.receiveCreatedMessage(createdMessage);
  }
};
