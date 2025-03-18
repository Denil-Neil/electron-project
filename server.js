const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000
});
const path = require('path');

app.use(express.static('public'));

// Add CORS headers for the web interface with more permissive settings
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.get('/sender', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sender.html'));
});

app.get('/receiver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('message', (msg) => {
    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
}); 
app.get('/', (req, res) => {
    res.send('Server is running!');
});