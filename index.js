const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;
const axios = require('axios');

// Load environment variables
require('dotenv').config();

// GitHub repository details
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_REPO = 'M1noa/simple-chat';
const GITHUB_FILE_PATH = 'chat.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHub token stored in .env

// Function to get the latest chat log from GitHub
async function getChatLog() {
    try {
        const res = await axios.get(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        // Ensure the response contains the `content` field
        if (!res.data || !res.data.content) {
            throw new Error('Chat log content is missing in the GitHub response');
        }

        // GitHub returns the file content in base64, decode it
        const content = Buffer.from(res.data.content, 'base64').toString('utf8');

        let chatLog = JSON.parse(content);

        // Ensure that the log is an array, even if empty
        if (!Array.isArray(chatLog)) {
            chatLog = [];
        }

        return chatLog;
    } catch (err) {
        console.error('Error fetching chat log from GitHub:', err.message);
        return [];
    }
}

// Function to update the chat log on GitHub
async function updateChatLog(newLog) {
    try {
        // Get the current chat log SHA (required for updating files on GitHub)
        const res = await axios.get(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        const sha = res.data.sha; // Required to update the file

        // Update the log on GitHub by appending new messages
        const updatedLog = JSON.stringify(newLog, null, 2); // Pretty-print the JSON

        await axios.put(
            `${GITHUB_API_URL}/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            {
                message: 'Update chat log',
                content: Buffer.from(updatedLog, 'utf8').toString('base64'), // GitHub requires base64 encoding
                sha: sha
            },
            {
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            }
        );
    } catch (err) {
        console.error('Error updating chat log:', err.message);
    }
}

server.listen(port, function() {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

let numUsers = 0;

io.on('connection', async function(socket) {
    let addedUser = false;

    // Send the current chat log to the newly connected client
    const chatLog = await getChatLog();
    socket.emit('chat log', chatLog);

    // When the client emits 'new message', this listens and executes
    socket.on('new message', async function(data) {
        console.log('New message event received:', data);

        // Prepare the message with username and timestamp
        let messageData = {
            username: socket.username,
            message: data,
            timestamp: new Date().toISOString()
        };

        // Fetch the current log and add the new message
        const existingLog = await getChatLog();
        existingLog.push(messageData);

        // Broadcast the message to other clients
        socket.broadcast.emit('new message', {
            username: socket.username,
            message: data
        });

        // Update the chat log on GitHub
        await updateChatLog(existingLog);
    });

    // When the client emits 'add user', this listens and executes
    socket.on('add user', function(username) {
        if (addedUser) return;

        // Store the username in the socket session for this client
        socket.username = username;
        ++numUsers;
        addedUser = true;

        console.log('Add user event received:', username);

        // Send login event to the user
        socket.emit('login', {
            numUsers: numUsers
        });

        // Echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
            username: socket.username,
            numUsers: numUsers
        });
    });

    // When the client emits 'disconnect', perform this
    socket.on('disconnect', async function() {
        if (addedUser) {
            --numUsers;

            console.log('User disconnected:', socket.username);

            // Echo globally that this client has left
            socket.broadcast.emit('user left', {
                username: socket.username,
                numUsers: numUsers
            });
        }
    });
});
