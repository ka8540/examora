const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// Import routes
const scrapeRoutes = require("./scrape/scrape_api");
const professorRoutes = require("./professor_api");

// Mount routes
app.use("/scrape", scrapeRoutes);
app.use("/api", professorRoutes);

app.listen(3000, () => {
  console.log("🚀 Master API running on http://localhost:3000");
});
