const express = require("express");
const bodyParser = require("body-parser");
const cookie = require("cookie-parser");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.static(path.join(__dirname, "upload")));

app.use(bodyParser.json());
app.use(cookie());

const port = process.env.MYSQL_PORT;

require("./database");

const routes = require("./routes");

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Credentials", true);
    const allowedOrigin = "https://etoile-sucree-front.vercel.app";
    const origin = req.headers.origin;
    if (allowedOrigin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header("Access-Control-Allow-Origin", allowedOrigin);
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE,PATCH,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Credentials", true);
    next();
});

app.use(routes);

app.listen(port, "0.0.0.0", () => {
    console.log(`serveur Node écoutant sur le port ${port}`);
});