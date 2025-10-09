import { useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfessorAssistant() {
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const name = query.get("name") || "Professor";

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);

  async function handleUpload() {
  if (!file) return;
  setUploading(true);
  setTopics([]);
  const token = localStorage.getItem("examora_token");
  const fd = new FormData();
  fd.append("file", file);

  try {
    // 1. upload exam
    const uploadRes = await fetch(`${API_BASE_URL}/api/assistant/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const uploadData = await uploadRes.json();
    setTopics(uploadData.topics || []);

    // 2. get sentiment breakdown for this professor
    const sentimentRes = await fetch(`${API_BASE_URL}/api/professors/sentiment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }), // name from query string
    });
    const sentimentData = await sentimentRes.json();
    const sentiment = sentimentData.sentimentBreakdown;

    // 3. compute difficulty tier
    const tierRes = await fetch(`${API_BASE_URL}/api/assistant/tier`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sentimentBreakdown: sentiment,
        avgDifficulty: 3.5, // placeholder until we use actual professor difficulty
      }),
    });
    const tierData = await tierRes.json();
    console.log("Difficulty tier:", tierData.tier);

  } catch (e) {
    console.error("Workflow failed:", e);
  } finally {
    setUploading(false);
  }
}


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-md">
        <CardHeader>
          <h1 className="text-xl font-semibold">
            👋 Hello Prof. {name}, how can I help you today?
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="examUpload">Upload your exam paper (PDF)</Label>
            <Input
              id="examUpload"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>

          {topics.length > 0 && (
            <div className="text-sm mt-4">
              <p className="text-muted-foreground mb-2">Detected topics:</p>
              <ul className="list-disc ml-5">
                {topics.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
