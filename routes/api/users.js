const router = require("express").Router();

const bcrypt = require("bcrypt");

const connection = require("../../database");
const jsonwebtoken = require("jsonwebtoken");
const { key, keyPub } = require("../../keys");

const nodeMailer = require("nodemailer");
const transporter = nodeMailer.createTransport({
    service: "Gmail",
    auth: {
        user: "etoile.sucree.cupcakes@gmail.com",
        pass: "cwuu wqdn wgxr utxr"
    }
});

// REGISTER

router.post("/addUser", async (req, res) => {
    const { name, firstname, mail, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `SELECT * FROM users WHERE mail= ?`;
    connection.query(sql, [mail], (err, result) => {
        try {
            if (err) throw err;
            if (result.length) {
                res.status(401).json("Adresse mail déjà existante");
            } else {
                const sqlInsert = `INSERT INTO users (name, firstname, mail, password) VALUES (?, ?, ?, ?)`;
                const values = [name, firstname, mail, hashedPassword];
                connection.query(sqlInsert, values, (err, result) => {
                    if (err) throw err;
                    res.status(200).json("Inscription réussie, vous allez être redirigé(e)");

                });
            }
        } catch (error) {
            console.error(error);
        }

    });
});

//LOGIN

router.post("/login", (req, res) => {
    const { mail, password } = req.body;
    const sql = `SELECT * FROM users WHERE mail= ?`;
    connection.query(sql, [mail], async (err, result) => {
        if (err) throw err;
        if (!result.length) {
            res.status(401).json('Email et/ou mot de passe incorrects');
        } else {
            const dbPassword = result[0].password;
            const passwordMatch = await bcrypt.compare(password, dbPassword);
            if (!passwordMatch) {
                res.status(401).json('Email et/ou mot de passe incorrects');
            } else {
                const token = jsonwebtoken.sign({}, key, {
                    subject: result[0].idUser.toString(),
                    expiresIn: 3600 * 24 * 30,
                    algorithm: "RS256"
                });
                res.cookie("token", token, { maxAge: 30 * 24 * 60 * 60 * 1000 });
                res.json(result[0]);
            }
        }
    });
});

//USING THE TOKEN TO GET THE ALREADY CONNECTED USER

router.get('/userConnected', (req, res) => {
    const { token } = req.cookies;
    if (token) {
        try {
            const decodedToken = jsonwebtoken.verify(token, keyPub, {
                algorithms: "RS256",
            });
            const sqlSelect = "SELECT idUser, name, firstname, mail, isAdmin FROM users WHERE idUser = ?";
            connection.query(sqlSelect, [decodedToken.sub], (err, result) => {
                if (err) throw err;
                const connectedUser = result[0];
                if (connectedUser) {
                    res.json(connectedUser);
                } else {
                    res.json(null);
                }
            });
        } catch (error) {
            console.log(error);
        }
    } else {
        res.json(null);
    }
});

//LOGOUT

router.delete("/logout", (req, res) => {
    res.clearCookie("token");
    res.send("Cookie cleared");
});

// MODIFY USER INFO

router.patch("/modifyUser", (req, res) => {
    const { name, firstname, mail, idUser } = req.body;
    const sql = "UPDATE users SET name = ?, firstname = ?, mail = ? WHERE idUser = ?";
    connection.query(sql, [name, firstname, mail, idUser], (err, result) => {
        if (err) throw err;
        res.sendStatus(200);
    });
});


// USER DELETES THEIR OWN ACCOUNT AFTER THE BACK VERIFIES THE PASSWORD IS CORRECT

router.delete("/deleteUser/:userId", (req, res) => {
    const { password } = req.body;
    const userId = req.params.userId;
    const verifySql = "SELECT * FROM users WHERE idUser = ?";
    connection.query(verifySql, [userId], async (err, result) => {
        if (err) throw err;
        const dbPassword = result[0].password;
        const passwordMatch = await bcrypt.compare(password, dbPassword);
        if (!passwordMatch) {
            res.status(401).json("Le mot de passe est incorrect.");
        } else {
            const deleteFavoritesSql = `DELETE FROM favorites WHERE idUser = ?`;
            connection.query(deleteFavoritesSql, [userId], (err, result) => {
                if (err) {
                    throw err;
                }
            });
            const deleteSql = `DELETE FROM users WHERE idUser = ?`;
            connection.query(deleteSql, [userId], (err, result) => {
                if (err) throw err;
                res.sendStatus(200);
            });
        }
    });
});

// REQUEST TO RESET THE FORGOTTEN PASSWORD, AN EMAIL IS SENT TO THE USER'S EMAIL ADDRESS WITH A RANDOMLY GENERATED CODE THEY HAVE TO ENTER

router.get("/resetForgottenPassword/:email", (req, res) => {
    const email = req.params.email;
    const sqlSearchEmail = "SELECT * FROM users WHERE mail = ?";
    connection.query(sqlSearchEmail, [email], (err, result) => {
        if (err) throw err;
        if (result.length !== 0) {
            let randomNumber = Math.floor(Math.random() * 9000 + 1000);
            const mailOptions = {
                from: "etoile.sucree.cupcakes@gmail.com",
                to: email,
                subject: "L'Étoile Sucrée - Mot de passe oublié",
                text: `Vous avez récemment effectué une demande de récupération de mot de passe. Si ce n'était pas vous, ne tenez pas compte de ce courriel. Sinon, veuillez entrez le mot de passe suivant : ${randomNumber}`
            };
            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    throw err;
                } else {
                    res.send(JSON.stringify(randomNumber));
                }
            });
        } else {
            res.status(401).json("L'adresse mail est introuvable.");
        }
    });
});

// IF THE CODE ENTERED BY THE USER IS CORRECT, THE PASSWORD IN DATABASE IS UPDATED

router.patch("/resetPassword/:email", async (req, res) => {
    const mail = req.params.email;
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "UPDATE users SET password = ? WHERE mail = ?";
    connection.query(sql, [hashedPassword, mail], (err, result) => {
        if (err) throw err;
        res.status(200).json("Votre mot de passe a bien été modifié, vous allez être redirigé(e).");
    });
});

// REQUEST TO CHANGE PASSWORDS WITH ALREADY EXISTING PASSWORD

router.patch("/modifyPassword/:id", async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const idUser = req.params.id;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const searchSql = "SELECT * FROM users WHERE idUser = ?";
    connection.query(searchSql, [idUser], async (err, result) => {
        if (err) {
            throw err;
        }
        const dataBasePassword = result[0]?.password;
        const passwordMatch = await bcrypt.compare(currentPassword, dataBasePassword);
        if (!passwordMatch) {
            res.status(401).json("Le mot de passe actuel est erronné");
        } else {
            const sql = "UPDATE users SET password = ? WHERE idUser = ?";
            connection.query(sql, [hashedPassword, idUser], (err, result) => {
                if (err) {
                    throw err;
                }
                res.status(200).json("Votre mot de passe a été modifié avec succès.");
            });
        }
    });
});

// REQUEST TO GET ALL USERS, USED FOR ADMIN TO DELETE A USER ACCOUNT

router.get("/getAllUsers", (req, res) => {
    const sql = "SELECT idUser, name, firstname FROM users";
    connection.query(sql, (err, result) => {
        if (err) throw err;
        res.send(JSON.stringify(result));
    });
});

// REQUEST FOR THE ADMIN TO DELETE SELECTED USER

router.delete("/adminDeleteUser", (req, res) => {
    const { idUser } = req.body;
    const deleteFavoritesSql = `DELETE FROM favorites WHERE idUser = ?`;
    connection.query(deleteFavoritesSql, [idUser], (err, result) => {
        if (err) {
            throw err;
        }
    });
    const sql = "DELETE FROM users WHERE idUser = ?";
    connection.query(sql, [idUser], (err, result) => {
        if (err) throw err;
        res.status(200).json("L'utilisateur a été supprimé avec succès !");
    });
});

module.exports = router;