const app = require('express')();
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
  console.log('Database connection successfull');
  const db = client.db(dbName);
  const users = db.collection('user');

  // Applying needed middlewares
  app.use(
    cors({
      origin: function (origin, callback) {
        // allow requests with no origin
        // (like mobile apps or curl requests)
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
    })
  );

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    console.log(`Login requested by User: ${username}`);
    users
      .findOne({ username, password })
      .then((user) => {
        if (user) {
          res.send({ status: 200 });
        } else {
          res.send({ status: 401 });
        }
      })
      .catch((err) => {
        console.error(
          `Error while finding the User:${username} from the database.`,
          err
        );
        res.send({ status: 500 });
      });
  });

  app.post('/signup', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const fullName = req.body.fullName;

    const userObj = { username, password, fullName };
    console.log('userObj:', userObj);
    users
      .insertOne(userObj)
      .then((signupResp) => {
        console.log('user added successfully');
        console.log('response of signup:', signupResp);
        res.send({ status: 200 });
      })
      .catch((err) => {
        console.log('Error while saving the User:', err);
        res.send({ status: 500 });
      });
  });

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });

  const idObjectMap = {};

  const sendMessage = (fromUser, toUser, message) => {
    const toSocket = idObjectMap[toUser];
    toSocket.emit('received_message', { message: message });
    res.send({ status: 200 });
  };

  app.post('/send_message', (req, res) => {
    const fromUser = req.body.from;
    const toUser = req.body.to;
    const message = req.body.message;

    sendMessage(fromUser, toUser, message);
  });
});

// io.on('connection', (socket) => {
//   console.log('socket:', socket.id);
//   idObjectMap[socket.id] = socket;
//   socket.on('chat message', (msg) => {
//     console.log('message: ', msg, 'socket id:', socket.id);
//     socket.broadcast.emit('received', { message: msg });
//   });
// });

http.listen(4000, () => {
  console.log('listening on *:4000');
});
