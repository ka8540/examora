import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, XAxis, YAxis, Bar, CartesianGrid, Legend } from "recharts";

type SentimentCounts = {
    POSITIVE: number;
    NEGATIVE: number;
    NEUTRAL: number;
    MIXED: number;
};

type DetailedSentiment = {
    course: string;
    review: string;
    sentiment: keyof SentimentCounts;
    scores: { Positive: number; Negative: number; Neutral: number; Mixed: number };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const COLORS = ["#16a34a", "#dc2626", "#64748b", "#a855f7"]; // positive, negative, neutral, mixed

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

const ProfessorDashboard = () => {
    const navigate = useNavigate();
    const query = useQuery();
    const name = query.get("name") || "";

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sentiments, setSentiments] = useState<SentimentCounts | null>(null);
    const [details, setDetails] = useState<DetailedSentiment[]>([]);
    const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);
    const [topics, setTopics] = useState<string[]>([]);
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("examora_token");
        if (!token) {
            navigate("/login");
            return;
        }
        if (!name.trim()) return;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE_URL}/api/professors/sentiment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ name }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Failed to fetch sentiment");

                setSentiments(data.sentimentBreakdown);
                setDetails(data.detailedSentiments || []);
                setLastAnalyzed(data.last_analyzed || null);
            } catch (e: any) {
                setError(e.message || "Something went wrong");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [name, navigate]);

    const pieData = useMemo(() => {
        if (!sentiments) return [] as { name: string; value: number }[];
        return [
            { name: "Positive", value: sentiments.POSITIVE },
            { name: "Negative", value: sentiments.NEGATIVE },
            { name: "Neutral", value: sentiments.NEUTRAL },
            { name: "Mixed", value: sentiments.MIXED },
        ];
    }, [sentiments]);

    const { courseAgg, hasCourseData } = useMemo(() => {
        const map: Record<string, SentimentCounts> = {};
        for (const d of details) {
            const keyRaw = (d.course || "Unknown").trim();
            const key = keyRaw.length === 0 ? "Unknown" : keyRaw;
            if (!map[key]) map[key] = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
            map[key][d.sentiment]++;
        }
        const rows = Object.entries(map).map(([course, counts]) => ({
            course,
            ...counts,
            __total: counts.POSITIVE + counts.NEUTRAL + counts.MIXED + counts.NEGATIVE,
        }));
        rows.sort((a, b) => b.__total - a.__total);
        const top = rows.slice(0, 10).map(({ __total, ...rest }) => rest);
        return { courseAgg: top, hasCourseData: top.some(r => (r.POSITIVE + r.NEUTRAL + r.MIXED + r.NEGATIVE) > 0) };
    }, [details]);

    const handleUpload = async (file?: File) => {
        if (!file) return;
        const token = localStorage.getItem("examora_token");
        if (!token) {
            navigate("/login");
            return;
        }
        setUploadBusy(true);
        setUploadError(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch(`${API_BASE_URL}/api/syllabus/topics`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to process syllabus");
            setTopics(Array.isArray(data.topics) ? data.topics : []);
        } catch (e: any) {
            setUploadError(e.message || "Upload failed");
        } finally {
            setUploadBusy(false);
        }
    };

    const recomputeSentiment = async () => {
        const token = localStorage.getItem("examora_token");
        if (!token || !name.trim()) return;
        setRefreshing(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/professors/sentiment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name, force: true }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to recompute");
            setSentiments(data.sentimentBreakdown);
            setDetails(data.detailedSentiments || []);
            setLastAnalyzed(data.last_analyzed || null);
        } catch {
            // noop; error banner handled above if needed
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
            <ThemeToggle />

            <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            {name ? `${name} — Review Insights` : "Review Insights"}
                        </h1>
                        {lastAnalyzed && (
                            <p className="text-xs text-muted-foreground mt-1">Last analyzed: {new Date(lastAnalyzed).toLocaleString()}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
                        <Button onClick={() => navigate("/professor-dashboard")}>New Search</Button>
                        <Button variant="outline" onClick={recomputeSentiment} disabled={refreshing}>
                            {refreshing ? "Recomputing…" : "Recompute sentiment"}
                        </Button>
                    </div>
                </div>

                {!name && (
                    <Card className="p-6">
                        <p className="text-sm">Missing professor name. Go back and start a scrape.</p>
                    </Card>
                )}

                {error && (
                    <Card className="p-6 border-destructive/40">
                        <p className="text-sm text-destructive">{error}</p>
                    </Card>
                )}

                {loading && (
                    <Card className="p-6">
                        <p className="text-sm">Loading insights…</p>
                    </Card>
                )}

                {!loading && sentiments && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6">
                            <h2 className="font-semibold mb-4">Overall Sentiment</h2>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card className="p-6 overflow-hidden">
                            <h2 className="font-semibold mb-2">Sentiment by Course</h2>
                            <p className="text-xs text-muted-foreground mb-4">Top 10 courses by number of reviews</p>
                            <div className="h-64">
                                {hasCourseData ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={courseAgg} margin={{ top: 8, right: 12, bottom: 24, left: 0 }} barCategoryGap={"20%"}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="course" interval={0} angle={-25} textAnchor="end" tick={{ fontSize: 11 }} height={40} />
                                            <YAxis allowDecimals={false} />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="POSITIVE" stackId="a" fill="#16a34a" />
                                            <Bar dataKey="NEUTRAL" stackId="a" fill="#64748b" />
                                            <Bar dataKey="MIXED" stackId="a" fill="#a855f7" />
                                            <Bar dataKey="NEGATIVE" stackId="a" fill="#dc2626" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                                        No per-course data available yet.
                                    </div>
                                )}
                            </div>
                        </Card>
                        <Card className="p-6">
                            <h2 className="font-semibold mb-4">Upload Syllabus (PDF)</h2>
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="syllabus">Choose file</Label>
                                    <Input id="syllabus" type="file" accept="application/pdf,image/*" disabled={uploadBusy}
                                        onChange={(e) => handleUpload(e.target.files?.[0] || undefined)} />
                                </div>
                                {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                                {topics.length > 0 && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Detected topics:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {topics.map((t, i) => (
                                                <span key={i} className="px-2 py-1 rounded-md border text-xs bg-background/40">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {!loading && details.length > 0 && (
                    <Card className="p-6">
                        <h2 className="font-semibold mb-4">Recent Reviews</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {details.slice(0, 12).map((r, i) => (
                                <div key={i} className="rounded-md border p-4 bg-background/40">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-muted-foreground">{r.course || "Unknown"}</span>
                                        <span className="text-xs font-medium">
                                            {r.sentiment === "POSITIVE" && "😊"}
                                            {r.sentiment === "NEGATIVE" && "😠"}
                                            {r.sentiment === "NEUTRAL" && "😐"}
                                            {r.sentiment === "MIXED" && "🤔"}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed line-clamp-6">{r.review}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default ProfessorDashboard;


