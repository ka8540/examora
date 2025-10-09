const express = require("express");
const router = express.Router();
const multer = require("multer");
const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");
const { ComprehendClient, DetectKeyPhrasesCommand } = require("@aws-sdk/client-comprehend");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const region = process.env.AWS_REGION || "us-east-1";
const textract = new TextractClient({ region });
const comprehend = new ComprehendClient({ region });
const bedrock = new BedrockRuntimeClient({ region });



function normalizeAndRankPhrases(phrases) {
    const counts = new Map();
    for (const p of phrases) {
        const text = (p.Text || "").trim();
        if (!text) continue;
        const norm = text.replace(/[^a-z0-9 \-]/gi, "").toLowerCase();
        if (norm.length < 3) continue;
        counts.set(norm, (counts.get(norm) || 0) + (p.Score || 0.5));
    }
    return Array.from(counts.entries())
        .map(([phrase, score]) => ({ phrase, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((x) => x.phrase);
}

router.post("/syllabus/topics", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Missing PDF file under field 'file'" });
        }
        const mime = req.file.mimetype || "";
        let fullText = "";

        if (/application\/(pdf)/i.test(mime)) {
            // Parse PDF locally (more reliable for sync flow)
            const parsed = await pdfParse(req.file.buffer);
            fullText = (parsed.text || "").trim();
        } else if (/image\/(png|jpeg|jpg|tiff)/i.test(mime)) {
            // OCR images via Textract
            const detect = new DetectDocumentTextCommand({ Document: { Bytes: req.file.buffer } });
            const detectResp = await textract.send(detect);
            const lines = (detectResp.Blocks || [])
                .filter((b) => b.BlockType === "LINE" && b.Text)
                .map((b) => b.Text);
            fullText = lines.join("\n");
        } else {
            return res.status(400).json({ error: "Unsupported file type. Upload a PDF or image." });
        }

        if (!fullText || fullText.length < 10) {
            return res.status(200).json({ topics: [], textLength: 0 });
        }

        // 2) Key phrases via Comprehend (chunk if necessary)
        if (!fullText || fullText.length < 20)
            return res.status(200).json({ topics: [], textLength: fullText.length });

        async function summarizeTopics(text) {
            try {
                console.log("Starting topic extraction for text length:", text.length);

                const prompt = `You are an academic assistant. Read this course syllabus text and
                extract 10 concise, subject-relevant topics that describe what is TAUGHT or COVERED in the course.
                Avoid filler words like instructor, project, grading, students, class, etc.
                Return topics as a comma-separated list.
                Text:\n\n${text.slice(0, 8000)}`;

                const cmd = new InvokeModelCommand({
                    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
                    contentType: "application/json",
                    accept: "application/json",
                    body: JSON.stringify({
                        anthropic_version: "bedrock-2023-05-31",
                        max_tokens: 200,
                        temperature: 0,
                        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
                    }),
                });

                console.log("Sending request to Bedrock...");

                // Add timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Bedrock API timeout after 30 seconds')), 30000);
                });

                const resp = await Promise.race([
                    bedrock.send(cmd),
                    timeoutPromise
                ]);

                console.log("Bedrock response received");
                const body = JSON.parse(new TextDecoder().decode(resp.body));
                console.log("Bedrock response body:", body);
                const textOut = body?.content?.[0]?.text || "";
                console.log("Extracted text:", textOut);

                if (!textOut) {
                    console.log("No text extracted from Bedrock response");
                    return ["No topics could be extracted"];
                }

                const topics = textOut.split(/[,\\n;]/).map(t => t.trim()).filter(Boolean).slice(0, 10);
                console.log("Final topics:", topics);
                return topics;

            } catch (error) {
                console.error("Error in summarizeTopics:", error);
                // Return a fallback response instead of throwing
                return ["Error extracting topics - please try again"];
            }
        }

        console.log("About to call summarizeTopics...");
        const topics = await summarizeTopics(fullText);
        console.log("Topics extracted:", topics);

        // Always return a response, even if topics extraction failed
        return res.json({
            topics: topics || ["Topics extraction in progress"],
            textLength: fullText.length,
            status: "success"
        });

    } catch (err) {
        console.error("Syllabus topics error:", err);
        console.error("Error details:", {
            message: err.message,
            code: err.code,
            name: err.name,
            stack: err.stack
        });
        res.status(500).json({
            error: "Failed to extract topics",
            details: err.message,
            code: err.code || 'UNKNOWN_ERROR'
        });
    }
});

module.exports = router;


