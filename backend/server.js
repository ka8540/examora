const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const authMiddleware = require("./authMiddleware");

dotenv.config(); 

const app = express();
app.use(bodyParser.json());

// Get env vars
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const region = process.env.AWS_REGION;

// Routes
const signupRoutes = require("./signup_api");
const loginRoutes = require("./login_api");
const scrapeRoutes = require("./scrape/scrape_api");
const professorRoutes = require("./professor_api");
const confirmSignupRoutes = require("./confirm_signup_api");
const sentimentRoutes = require("./professor_sentiment_api");

// Public routes (no token needed)
app.use("/auth", signupRoutes);
app.use("/auth", loginRoutes);
app.use("/auth", confirmSignupRoutes);

// Protected routes (require Cognito token)
app.use("/scrape", authMiddleware(userPoolId, region), scrapeRoutes);
app.use("/api", authMiddleware(userPoolId, region), professorRoutes);
app.use("/api", authMiddleware(userPoolId, region), sentimentRoutes);

app.listen(3000, () => {
  console.log("Master API running on http://localhost:3000");
});
