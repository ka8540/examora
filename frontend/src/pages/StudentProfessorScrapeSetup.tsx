import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "@/components/ParticleBackground";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const StudentProfessorScrapeSetup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepMsg, setStepMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("examora_token");
    if (!token) navigate("/login");
  }, [navigate]);

  const startScrape = async () => {
    const token = localStorage.getItem("examora_token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!name.trim()) {
      setError("Please enter the professor name.");
      return;
    }

    setError(null);
    setLoading(true);
    setStepMsg("Queuing scrape job…");

    try {
      const res = await fetch(`${API_BASE_URL}/scrape/professor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Scrape failed");
      }

      setStepMsg("Scraping reviews…");

      await res.json();

      setStepMsg("Preparing student dashboard…");

      setTimeout(() => {
        // ⬅️ THIS IS THE ONLY DIFFERENCE
        navigate(`/student-professor-analysis?name=${encodeURIComponent(name)}`);
      }, 800);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <ParticleBackground />
      <ThemeToggle />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.20)_0%,transparent_55%)]" />

      <Card className="relative z-10 w-full max-w-xl px-8 py-10 space-y-8 bg-[var(--gradient-card)] border-border/50 shadow-[var(--shadow-card)]">
        <div className="text-center space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent"
          >
            Professor Review Fetch
          </motion.h1>
          <p className="text-muted-foreground">
            Enter the professor name. If missing in the database, it will be
            scraped automatically and sent to your student analysis dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <Label htmlFor="prof">Professor Name</Label>
          <Input
            id="prof"
            placeholder="e.g., John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button
            onClick={startScrape}
            disabled={loading || !name.trim()}
            className="w-full"
          >
            {loading ? "Fetching…" : "Continue"}
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-md bg-background/50 z-20 flex items-center justify-center"
          >
            <div className="flex flex-col items-center space-y-3">
              <motion.div
                className="w-20 h-20 border-4 rounded-full border-primary border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              />
              <p className="text-sm">{stepMsg || "Working…"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentProfessorScrapeSetup;
