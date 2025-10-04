const express = require("express");
const router = express.Router();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  GetCommand,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");
const {
  ComprehendClient,
  DetectSentimentCommand
} = require("@aws-sdk/client-comprehend");

const client = new DynamoDBClient({ region: "us-east-1" });
const dynamodb = DynamoDBDocumentClient.from(client);
const comprehend = new ComprehendClient({ region: "us-east-1" });

const TABLE_NAME = "ProfessorsReviews";

// Helper: check if timestamp is older than 1 month
function isOlderThanOneMonth(timestamp) {
  if (!timestamp) return true;
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return new Date(timestamp) < oneMonthAgo;
}

router.post("/professors/sentiment", async (req, res) => {
  const { professor, name } = req.body;
  const profName = name || professor;

  if (!profName)
    return res.status(400).json({ error: "Professor name required" });

  try {
    // Step 1: Find professor by name (scan since no GSI yet)
    const profResult = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#n = :name",
        ExpressionAttributeNames: { "#n": "name" },
        ExpressionAttributeValues: { ":name": profName }
      })
    );

    if (!profResult.Items || profResult.Items.length === 0)
      return res.status(404).json({ error: "Professor not found" });

    const professorItem = profResult.Items[0];
    const professorId = professorItem.professor_id;

    // Step 2: Check if sentiment already exists and is fresh
    const sentimentResult = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          professor_id: professorId,
          sort_key: `SENTIMENT#${professorId}`
        }
      })
    );

    if (
      sentimentResult.Item &&
      !isOlderThanOneMonth(sentimentResult.Item.last_analyzed)
    ) {
      return res.json({
        professor: profName,
        sentimentBreakdown: sentimentResult.Item.sentimentBreakdown,
        source: "cached",
        last_analyzed: sentimentResult.Item.last_analyzed
      });
    }

    // Step 3: Fetch all reviews for that professor_id
    const reviewsResult = await dynamodb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression:
          "professor_id = :pid AND begins_with(sort_key, :rev)",
        ExpressionAttributeValues: { ":pid": professorId, ":rev": "REV#" }
      })
    );

    const comments = reviewsResult.Items.map(r => r.comment).filter(Boolean);
    if (comments.length === 0)
      return res
        .status(404)
        .json({ error: "No reviews found for sentiment analysis" });

    // Step 4: Run sentiment analysis
    const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };

    for (const comment of comments) {
      const command = new DetectSentimentCommand({
        Text: comment,
        LanguageCode: "en"
      });
      const response = await comprehend.send(command);
      sentimentCounts[response.Sentiment]++;
    }

    const resultItem = {
      professor_id: professorId,
      sort_key: `SENTIMENT#${professorId}`,
      type: "sentiment",
      name: profName,
      sentimentBreakdown: sentimentCounts,
      totalReviews: comments.length,
      last_analyzed: new Date().toISOString()
    };

    // Step 5: Save sentiment results
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: resultItem
      })
    );

    // Step 6: Return fresh result
    res.json({
      professor: profName,
      sentimentBreakdown: sentimentCounts,
      totalReviews: comments.length,
      source: "fresh",
      last_analyzed: resultItem.last_analyzed
    });
  } catch (err) {
    console.error("Sentiment analysis error:", err);
    res.status(500).json({ error: "Sentiment analysis failed" });
  }
});

module.exports = router;
