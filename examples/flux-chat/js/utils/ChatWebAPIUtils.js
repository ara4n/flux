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

var sdk;
var client;
var homeserverUrl = "https://matrix.org";

function _getBody(event) {
    if (event.content.msgtype === "m.emote") {
      return ("* " + client.getFriendlyDisplayName(event.user_id, event.room_id) + " " + event.content.body);
    }
    else {
      return event.content.body;
    }    
}

module.exports = {

  init: function(callback) {
    sdk = require("matrix-js-sdk");
    sdk.request(require("browser-request"));

    client = sdk.createClient(homeserverUrl, {}, new sdk.MatrixInMemoryStore());
    var credentials = JSON.parse(localStorage.getItem('credentials'));
    if (!credentials || !credentials.accessToken) {
      var userId = prompt("Enter your matrix user id");
      var password = prompt("Enter your matrix password (WARNING: your typing will be visible)");
      client.loginWithPassword(userId, password, function(err, data) {
        if (err) {
          alert(JSON.stringify(err));
        }
        client.credentials.accessToken = data.access_token;
        client.credentials.userId = data.user_id;
        localStorage.setItem('credentials', JSON.stringify(client.credentials));
        callback();
      });
    } else {
      client.credentials.accessToken = credentials.accessToken;
      client.credentials.userId = credentials.userId;
      callback();
    }
  },

  getAllMessages: function() {
    client.startClient(function(err, events, live) {
      var rawMessages = [];
      if (err) {
        console.error("err %s", JSON.stringify(err));
      } else {
        for (var i = 0; i < events.length; i++) {
          var event = events[i].event;
          if (event.type !== "m.room.message") continue;
          if (live && event.user_id === client.credentials.userId) continue; // XXX: local echo hack
          var message = {
            id: event.event_id,
            threadID: event.room_id,
            // XXX: should these be event.getHelper() methods instead?
            threadName: client.getFriendlyRoomName(event.room_id),
            authorName: client.getFriendlyDisplayName(event.user_id, event.room_id),
            text: _getBody(event),
            timestamp: event.origin_server_ts,
          };
          rawMessages.push(message);
        }
      }
      ChatServerActionCreators.receiveAll(rawMessages);
    }, 12);
  },

  getUserId: function() {
    return client.credentials.userId;
  },
  
  createMessage: function(message) {
    var timestamp = Date.now();
    var id = 'm_' + timestamp;
    var threadID = message.threadID || ('t_' + Date.now());
    var createdMessage = {
      id: id,
      threadID: threadID,
      threadName: client.getFriendlyRoomName(threadID),
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
