const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./sakura'); 

require('events').EventEmitter.defaultMaxListeners = 500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/code', code);


app.set('json spaces', 2); 

app.get('/', (req, res) => {
    let info = { sessionsOnline: 0, botName: 'Bot', numbers: [], timestamp: new Date().toISOString() };
    try {
        if (typeof code.getActiveInfo === 'function') info = code.getActiveInfo();
    } catch (e) {}

    res.status(200).json({
        status: 'online',
        name: info.botName,
        about: `${info.botName} is up and running.`,
        sessions_online: info.sessionsOnline,
        server_time: info.timestamp
    });
});

app.listen(PORT, () => {
    console.log(`
Don't Forget To Give Star ‼️


Server running on http://localhost:` + PORT)
});

module.exports = app;
