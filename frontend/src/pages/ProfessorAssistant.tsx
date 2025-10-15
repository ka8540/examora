import { useLocation } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function ProfessorAssistant() {
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const name = query.get("name") || "Professor";

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tier, setTier] = useState("Medium");
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Auto-fetch difficulty tier from backend sentiment API
  useEffect(() => {
    async function fetchTier() {
      try {
        const token = localStorage.getItem("examora_token");
        const res = await fetch(`${API_BASE_URL}/api/professors/sentiment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.difficultyTier) {
          setTier(data.difficultyTier);
        }
      } catch (err) {
        console.error("Tier fetch failed:", err);
      }
    }

    fetchTier();
  }, [name]);

  // 🔹 Generate questions
  async function handleGenerate() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setQuestions([]);
    try {
      const token = localStorage.getItem("examora_token");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tier", tier);

      const res = await fetch(`${API_BASE_URL}/api/assistant/questions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to generate questions");

      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-md">
        <CardHeader>
          <h1 className="text-xl font-semibold">
            👋 Hello Prof. {name}, how can I help you today?
          </h1>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Difficulty Tier Section */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="tier">Difficulty tier (auto-detected)</Label>
              <span
                className={
                  tier === "Hard"
                    ? "text-red-500 font-medium"
                    : tier === "Medium"
                    ? "text-yellow-500 font-medium"
                    : "text-green-500 font-medium"
                }
              >
                {tier}
              </span>
            </div>

            <select
              id="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full border rounded-md p-2 mt-1"
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>

          {/* File Upload */}
          <div>
            <Label htmlFor="examUpload">
              Upload your exam or syllabus (PDF)
            </Label>
            <Input
              id="examUpload"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? "Generating questions..." : "Generate Exam Questions"}
          </Button>

          {/* Error */}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Generated Questions */}
          {questions.length > 0 && (
            <div className="space-y-2 mt-4">
              <h2 className="text-lg font-semibold">
                Generated Questions ({tier})
              </h2>
              <Textarea
                value={questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}
                rows={12}
                readOnly
                className="resize-none"
              />
              <Button
                onClick={() => {
                  const blob = new Blob(
                    [questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n")],
                    { type: "text/plain" }
                  );
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `questions_${tier}.txt`;
                  link.click();
                }}
                className="w-full"
              >
                Download Questions
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
