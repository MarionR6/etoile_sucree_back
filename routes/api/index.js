const router = require("express").Router();
const apiUsers = require("./users");
const apiRecipes = require("./recipes");

router.use("/users", apiUsers);
router.use("/recipes", apiRecipes);

module.exports = router;