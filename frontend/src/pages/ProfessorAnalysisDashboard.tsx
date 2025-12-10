import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import ParticleBackground from "@/components/ParticleBackground";
import { motion, AnimatePresence } from "framer-motion";

import {
  BarChart,
  Bar,
  LabelList,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

type SentimentLabel = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";

interface DetailedSentiment {
  course: string;
  review: string;
  sentiment: SentimentLabel;
  scores: any;
}

interface SentimentApiResponse {
  professor: string;
  sentimentBreakdown: Record<SentimentLabel, number>;
  detailedSentiments: DetailedSentiment[];
  totalReviews: number;
  source: "fresh" | "cached";
  last_analyzed: string;
}

interface CourseStats {
  course: string;
  totalReviews: number;
  sentimentCounts: Record<SentimentLabel, number>;
  positivity: number;
  difficulty: "Easy" | "Moderate" | "Hard";
}

const ProfessorAnalysisDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const professorName = searchParams.get("name") || "";

  const [loading, setLoading] = useState(false);
  const [stepMsg, setStepMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SentimentApiResponse | null>(null);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);

  // THEME COLORS — pulled once, updates automatically due to CSS variables
  const [colors, setColors] = useState({
    primary: "#8b5cf6", // fallback violet
    secondary: "#a855f7",
    muted: "#888888",
  });

  useEffect(() => {
    const getColor = (v: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(v).trim();

    setColors({
      primary: getColor("--primary") || "#8b5cf6",
      secondary: getColor("--secondary") || "#a855f7",
      muted: getColor("--muted-foreground") || "#888888",
    });
  }, []); // DO NOT depend on className

  // AUTH GUARD
  useEffect(() => {
    const token = localStorage.getItem("examora_token");
    if (!token) navigate("/login");
  }, [navigate]);

  // FETCH DATA
  useEffect(() => {
    if (!professorName.trim()) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setStepMsg("Loading sentiment data…");

      const token = localStorage.getItem("examora_token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/professors/sentiment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: professorName }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to fetch sentiment data");
        }

        const data: SentimentApiResponse = await res.json();
        setSummary(data);
        setStepMsg("Analyzing courses…");

        const byCourse: Record<string, CourseStats> = {};

        for (const item of data.detailedSentiments || []) {
          const key = (item.course || "Unknown").trim();

          if (!byCourse[key]) {
            byCourse[key] = {
              course: key,
              totalReviews: 0,
              sentimentCounts: {
                POSITIVE: 0,
                NEGATIVE: 0,
                NEUTRAL: 0,
                MIXED: 0,
              },
              positivity: 0,
              difficulty: "Moderate",
            };
          }

          const cs = byCourse[key];
          cs.totalReviews++;
          cs.sentimentCounts[item.sentiment]++;
        }

        Object.values(byCourse).forEach((c) => {
          const total = c.totalReviews || 1;
          const score =
            ((c.sentimentCounts.POSITIVE ?? 0) +
              0.5 * (c.sentimentCounts.MIXED ?? 0)) /
            total;

          c.positivity = +(score * 100).toFixed(2);

          if (c.positivity >= 70) c.difficulty = "Easy";
          else if (c.positivity <= 40) c.difficulty = "Hard";
          else c.difficulty = "Moderate";
        });

        setCourseStats(
          Object.values(byCourse).sort((a, b) => b.totalReviews - a.totalReviews)
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setTimeout(() => setLoading(false), 300);
      }
    };

    fetchData();
  }, [professorName, navigate]);

  // DATA FOR AREA CHART
  const areaData = useMemo(
    () =>
      courseStats.map((c) => ({
        course: c.course,
        positivity: c.positivity,
      })),
    [courseStats]
  );

  // DATA FOR RADIAL BAR CHART — fixed colors
  const radialData = useMemo(
    () =>
      courseStats.map((c) => ({
        name: c.course,
        value: c.sentimentCounts.POSITIVE + c.sentimentCounts.MIXED,
        fill: colors.primary, // consistent & theme-aware
      })),
    [courseStats, colors.primary]
  );

  const pieData = summary
    ? [
        { name: "Positive", value: summary.sentimentBreakdown.POSITIVE },
        { name: "Neutral", value: summary.sentimentBreakdown.NEUTRAL },
        { name: "Negative", value: summary.sentimentBreakdown.NEGATIVE },
        { name: "Mixed", value: summary.sentimentBreakdown.MIXED },
      ]
    : [];

    const strengthData = useMemo(
        () =>
            courseStats.map((c) => ({
            course: c.course,
            strength:
                c.sentimentCounts.POSITIVE +
                0.5 * (c.sentimentCounts.MIXED ?? 0),
            })),
        [courseStats]
        );


  const lastAnalyzed =
    summary &&
    new Date(summary.last_analyzed).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });

  // UI
  return (
    <div className="relative min-h-screen flex flex-col bg-gradient-to-br from-primary/10 via-background to-secondary/10 overflow-hidden">
      <ParticleBackground />
      <ThemeToggle />

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Professor Analysis
            </h1>
            <p className="text-muted-foreground">Sentiment profile for {professorName}</p>

            {summary && (
              <p className="text-xs text-muted-foreground mt-1">
                Last analyzed: {lastAnalyzed} · Source: {summary.source}
              </p>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            Back
          </Button>
        </motion.div>

        {/* ERROR */}
        {error && (
          <Card className="p-4 border border-red-500/40 bg-red-500/10">
            <p className="text-red-400">{error}</p>
          </Card>
        )}

        {/* SUMMARY CARDS */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-[var(--gradient-card)]">
              <p className="text-xs text-muted-foreground uppercase">Total Reviews</p>
              <p className="text-2xl font-semibold">{summary.totalReviews}</p>
            </Card>

            <Card className="p-4 bg-[var(--gradient-card)]">
              <p className="text-xs text-muted-foreground uppercase">Overall Sentiment</p>
              <p className="text-sm">
                👍 {summary.sentimentBreakdown.POSITIVE} · 😐{" "}
                {summary.sentimentBreakdown.NEUTRAL} · 👎{" "}
                {summary.sentimentBreakdown.NEGATIVE} · ⚖️{" "}
                {summary.sentimentBreakdown.MIXED}
              </p>
            </Card>

            <Card className="p-4 bg-[var(--gradient-card)]">
              <p className="text-xs text-muted-foreground uppercase">Distinct Courses</p>
              <p className="text-2xl font-semibold">{courseStats.length}</p>
            </Card>
          </div>
        )}

        {/* CHARTS */}
        {courseStats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AREA CHART */}
            <Card className="p-4 bg-[var(--gradient-card)]">
              <h2 className="text-sm font-semibold mb-2">
                Positivity Trend by Course
              </h2>

              <ResponsiveContainer height={300}>
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke={colors.muted} strokeDasharray="3 3" />
                  <XAxis stroke={colors.muted} dataKey="course" />
                  <YAxis stroke={colors.muted} />
                  <Tooltip />

                  <Area
                    type="monotone"
                    dataKey="positivity"
                    stroke={colors.primary}
                    fill="url(#areaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* RADIAL BAR CHART — FIXED */}
            {/* SENTIMENT STRENGTH BY COURSE — CLEAN PURPLE BAR CHART */}
                <Card className="p-4 bg-[var(--gradient-card)]">
                <h2 className="text-sm font-semibold mb-2">
                    Sentiment Strength by Course
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                    Higher score = more positive/mixed sentiment for that course.
                </p>

                <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                    layout="vertical"
                    data={strengthData}
                    margin={{ top: 10, right: 20, left: 50, bottom: 10 }}
                    >
                    <CartesianGrid
                        stroke={colors.muted}
                        strokeDasharray="3 3"
                        horizontal={true}
                        vertical={false}
                    />
                    <XAxis
                        type="number"
                        stroke={colors.muted}
                        tick={{ fontSize: 10 }}
                    />
                    <YAxis
                        type="category"
                        dataKey="course"
                        stroke={colors.muted}
                        tick={{ fontSize: 10 }}
                        width={100}
                    />
                    <Tooltip />

                    <Bar
                        dataKey="strength"
                        radius={[8, 8, 8, 8]}
                        fill={colors.primary}  // theme-aware purple
                    >
                        <LabelList
                        dataKey="strength"
                        position="right"
                        style={{ fill: colors.primary, fontSize: 11, fontWeight: 600 }}
                        />
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </Card>

          </div>
        )}

        {/* COURSE CARDS */}
        {courseStats.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Courses Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {courseStats.map((c) => (
                <Card key={c.course} className="p-4 bg-[var(--gradient-card)]">
                  <p className="font-semibold text-sm">{c.course}</p>
                  <p className="text-xs text-muted-foreground">Reviews: {c.totalReviews}</p>
                  <p className="text-xs">Positivity: {c.positivity.toFixed(1)}%</p>
                  <p className="text-xs">
                    Difficulty:{" "}
                    <span
                      className={
                        c.difficulty === "Easy"
                          ? "text-emerald-400"
                          : c.difficulty === "Hard"
                          ? "text-red-400"
                          : "text-amber-400"
                      }
                    >
                      {c.difficulty}
                    </span>
                  </p>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* LOADER */}
      <AnimatePresence>
        {loading && (
          <motion.div className="absolute inset-0 z-50 bg-background/50 backdrop-blur-md flex items-center justify-center">
            <p className="text-lg font-medium">{stepMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfessorAnalysisDashboard;
