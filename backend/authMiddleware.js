// authMiddleware.js
const jwt = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

let pems;

async function getPems() {
  if (pems) return pems;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.AWS_REGION;
  const url = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  const { data } = await axios.get(url);

  pems = {};
  data.keys.forEach((key) => {
    pems[key.kid] = jwkToPem(key);
  });
  return pems;
}

module.exports = () => {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
      const decoded = jwt.decode(token, { complete: true });
      const pems = await getPems();
      const pem = pems[decoded.header.kid];

      jwt.verify(token, pem, (err, payload) => {
        if (err) return res.status(401).json({ error: "Invalid token" });
        req.user = payload;
        next();
      });
    } catch (err) {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
};
