const app = require('express')();
const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
const { MongoClient } = require('mongodb');

const bodyParser = require('body-parser');

const allowedOrigins = ['https://cryptic-journey-31189.herokuapp.com'];

const uri =
  'mongodb+srv://<username>:<password>cluster0-yqxkh.mongodb.net/test?retryWrites=true&w=majority';

const mongoClient = new MongoClient(uri, { useUnifiedTopology: true });

const dbName = 'chat-app';

mongoClient.connect().then((client) => {
  console.log('Database connection successful');
  const db = client.db(dbName);
  const users = db.collection('user');

  // Validating the CORS requests
  app.use(
    cors({
      origin: function (origin, callback) {
        // allow requests with no origin for postman reqests
        console.debug('Request came through:', origin);
        if (!origin) return callback(null, true);
        const tokens = origin.split(':');
        const originWithoutPort = `${tokens[0]}:${tokens[1]}`;
        if (allowedOrigins.indexOf(originWithoutPort) === -1) {
          const msg =
            'The CORS policy for this site does not ' +
            'allow access from the specified Origin.';
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );

  // Middle ware for parsing the request object
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use(express.static(path.join(__dirname, 'build')));

  // Middle ware for using the sessions
  app.use(
    session({
      secret: 'ssshhhhh',
      saveUninitialized: true,
      resave: true,
    })
  );

  app.use('', (req, res, next) => {
    const authPaths = ['/', '/login', '/signup', '/test_session'];
    if (authPaths.includes(req.path)) {
      return next();
    }

    console.log('req.session:', req.session);
    if (!req.session.username) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }

    return next();
  });

  app.post('/login', (req, res) => {
    const sess = req.session;
    const username = req.body.username;
    const password = req.body.password;

    console.log(`Login requested by User: ${username}`);
    users
      .findOne({ username, password })
      .then((user) => {
        if (user) {
          sess.username = username;
          sess.fullname = user.fullname;
          res.status(200).send({
            message: 'Logged in successfully',
            fullname: user.fullname,
          });
        } else {
          res.status(401).send({ message: 'Incorrect Credentials Provided' });
        }
      })
      .catch((err) => {
        console.error(
          `Error while finding the User:${username} from the database.`,
          err
        );
        res.status(500).send({ message: 'Internal server error occurred' });
      });
  });

  app.get('/test_session', (req, res) => {
    const sess = req.session;
    if (sess.username) {
      res
        .status(200)
        .send({ username: sess.username, fullname: sess.fullname });
    } else {
      res.status(401).send({ message: 'Unauthorized access' });
    }
  });

  app.get('/get_active_users', (req, res) => {
    const activeUsers = {};
    Object.keys(userSocketMap).forEach((username) => {
      activeUsers[username] = userSocketMap[username].fullname;
    });

    res.status(200).send({ activeUsers: activeUsers });
  });

  app.post('/signup', (req, res) => {
    const sess = req.session;
    const username = req.body.username;
    const password = req.body.password;
    const fullname = req.body.fullname;

    sess.username = username;
    sess.fullname = fullname;

    const userObj = { username, password, fullname };
    users
      .insertOne(userObj)
      .then(() => {
        res.status(200).send({ message: 'Signed Up successfully' });
      })
      .catch((err) => {
        console.error('Error while saving the User:', err);
        res.status(500).send({ message: 'Internal server error occurred' });
      });
  });

  const userSocketMap = {};

  const sendMessage = (fromUser, toUser, message) => {
    const toSocket = userSocketMap[toUser];
    toSocket.emit('received_message', { message: message });
    res.send({ status: 200 });
  };

  io.on('connection', (socket) => {
    const query = socket.handshake.query;
    userSocketMap[query.username] = { socket, fullname: query.fullname };
    socket.on('message_sent', (message) => {
      if (!userSocketMap[message.toUser]) {
        return;
      }

      const toUserSocket = userSocketMap[message.toUser].socket;
      toUserSocket.emit('message_received', {
        text: message.text,
        fromUser: message.fromUser,
      });
    });
  });

  app.post('/send_message', (req, res) => {
    const fromUser = req.body.from;
    const toUser = req.body.to;
    const message = req.body.message;

    sendMessage(fromUser, toUser, message);
  });

  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
});

const PORT = process.env.PORT || 4000;
http.listen(PORT, () => {
  console.log('listening on *:', PORT);
});
