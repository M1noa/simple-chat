$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = ['#e21400', '#91580f', '#f8a700', '#f78b00', '#58dc00', '#287b00', '#a8f07a', '#4ae8c4', '#3b88eb', '#3824aa', '#a700ff', '#d300e7'];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page
  var $messages = $('.messages'); // Messages area

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  // Sets the client's username
  function setUsername() {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage() {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // If there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // Tell the server to execute 'new message' and send along the message
      socket.emit('new message', message);
    }
  }

  // Log a message
  function addChatMessage(data) {
    var $messageDiv = $('<li class="message"/>')
      .text(data.username + ": " + data.message);
    $messages.append($messageDiv);
  }

  // Updates the typing event
  function updateTyping() {
    if (connected && !typing) {
      typing = true;
      socket.emit('typing');
    }
    lastTypingTime = (new Date()).getTime();

    setTimeout(function () {
      var typingTimer = (new Date()).getTime();
      var timeDiff = typingTimer - lastTypingTime;
      if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
        socket.emit('stop typing');
        typing = false;
      }
    }, TYPING_TIMER_LENGTH);
  }

  // Prevents input from having injected markup
  function cleanInput(input) {
    return $('<div/>').text(input).text();
  }

  // Keyboard events
  $window.keydown(function(event) {
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Focus input when clicking anywhere on login page
  $loginPage.click(function() {
    $currentInput.focus();
  });

  // Whenever the server emits 'login', log the login message
  socket.on('login', function(data) {
    connected = true;
    console.log('Login successful. Number of users:', data.numUsers);

    var message = 'Welcome to The Comfy Chat';
    addChatMessage({
      username: 'Server',
      message: message
    });
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function(data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat
  socket.on('user joined', function(data) {
    console.log('User joined:', data.username, 'Number of users:', data.numUsers);
    var message = data.username + ' joined the chat.';
    addChatMessage({
      username: 'Server',
      message: message
    });
  });

  // Whenever the server emits 'user left', log it in the chat
  socket.on('user left', function(data) {
    console.log('User left:', data.username, 'Number of users:', data.numUsers);
    var message = data.username + ' left the chat.';
    addChatMessage({
      username: 'Server',
      message: message
    });
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function(data) {
    var $typingMessage = $('<li class="message typing"/>')
      .text(data.username + ' is typing...');
    $messages.append($typingMessage);
  });

  // Whenever the server emits 'stop typing', remove the typing message
  socket.on('stop typing', function() {
    $messages.find('.typing').remove();
  });

  // Load the past chat log from the server on page load
  socket.on('chat log', function(chatLog) {
    chatLog.forEach(function(logEntry) {
      addChatMessage(logEntry);
    });
  });
});
