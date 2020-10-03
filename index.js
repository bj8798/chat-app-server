const app = require('express')();
const session = require('express-session');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
const { MongoClient } = require('mongodb');

const bodyParser = require('body-parser');

const allowedOrigins = ['http://localhost:3000', 'http://192.168.0.105:3000'];

const uri =
  'mongodb+srv://bhargav:B$$j8798@cluster0-yqxkh.mongodb.net/test?retryWrites=true&w=majority';

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
        if (allowedOrigins.indexOf(origin) === -1) {
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

  // Middle ware for using the sessions
  app.use(
    session({ secret: 'ssshhhhh', saveUninitialized: true, resave: true })
  );

  app.use('', (req, res, next) => {
    console.log('At auth middleware.');

    const authPaths = ['/', '/login', '/signup', '/test_session'];
    if (authPaths.includes(req.path)) {
      return next();
    }

    if (!req.session.username) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }

    return next();
  });

  // Below is the previous code which need to be refactored
  app.get('/', (req, res) => {
    console.log('get request');
    req.session.name = 'testname';
    res.send('Done');
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
    console.log('activeUsers:', activeUsers);
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
        console.log('Error while saving the User:', err);
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
    console.log('userSocketMap: ', userSocketMap);
    socket.on('message_sent', (message) => {
      console.log('message: ', message);
      console.log('toUser Info:', userSocketMap[message.toUser]);

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
});

http.listen(4000, () => {
  console.log('listening on *:4000');
});
