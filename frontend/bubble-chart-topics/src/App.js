import React, { useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Papa from "papaparse";
import { X } from "lucide-react";

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [sourceData, setSourceData] = useState([]);

  const processCSV = (csvText) => {
    setLoading(true);
    setError(null);
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const rows = results.data;

        let correoCount = 0;
        let tweetCount = 0;
        let alemanCount = 0;
        let espanolCount = 0;

        rows.forEach((row) => {
          if (row.Fuente && row.Fuente.trim().toUpperCase() === "C") {
            correoCount++;
          } else {
            tweetCount++;
          }

          const lang = row.Lang ? row.Lang.trim().toUpperCase() : "";
          if (lang === "A") alemanCount++;
          if (lang === "E") espanolCount++;
        });

        setSourceData([
          { name: "Emails", value: correoCount, color: "#3b82f6" },
          { name: "Tweets", value: tweetCount, color: "#10b981" },
        ]);

        const langData = [
          { name: "German", value: alemanCount, color: "#f59e0b" },
          { name: "Spanish", value: espanolCount, color: "#ec4899" },
        ];

        const topicsMap = {};

        rows.forEach((row) => {
          const topic =
            row.BERTopic_Topic !== undefined ? row.BERTopic_Topic : "Sin tema";
          const lang = row.Lang ? row.Lang.trim().toUpperCase() : "";
          const sentiment = parseFloat(row.SentimentScore);

          if (!topicsMap[topic]) {
            let cleanKeywords = "";
            if (row.BERTopic_Translated_Keywords) {
              cleanKeywords = row.BERTopic_Translated_Keywords.replace(
                /[\[\]'\"]/g,
                ""
              ).trim();
            }

            topicsMap[topic] = {
              topic: topic,
              total: 0,
              langA: 0,
              langE: 0,
              sentimentSum: 0,
              sentimentCount: 0,
              keywords: cleanKeywords,
              repTweet: row.BERTopic_Representative_Tweet_En || "",
              tweets: [],
            };
          }

          topicsMap[topic].total++;

          if (lang === "A") topicsMap[topic].langA++;
          if (lang === "E") topicsMap[topic].langE++;

          if (!isNaN(sentiment)) {
            topicsMap[topic].sentimentSum += sentiment;
            topicsMap[topic].sentimentCount++;
          }

          if (row.Tweet_limpio || row.Procesado) {
            topicsMap[topic].tweets.push({
              text: row.Tweet_limpio || row.Procesado || "",
              sentiment: sentiment,
              lang: lang,
              fuente: row.Fuente,
            });
          }
        });

        const processedData = Object.values(topicsMap)
          .map((item, index) => ({
            topic: `Topic ${item.topic}`,
            topicId: item.topic,
            yPosition: index + 1,
            total: item.total,
            langA: item.langA,
            langE: item.langE,
            avgSentiment:
              item.sentimentCount > 0
                ? item.sentimentSum / item.sentimentCount
                : 0,
            propA: item.total > 0 ? (item.langA / item.total) * 100 : 0,
            keywords: item.keywords,
            repTweet: item.repTweet,
            tweets: item.tweets,
          }))
          .sort((a, b) => a.avgSentiment - b.avgSentiment);

        setData(processedData);
        setStats({
          totalTopics: processedData.length,
          totalTweets: rows.length,
          totalCorreos: correoCount,
          totalTweetsSource: tweetCount,
          totalAleman: alemanCount,
          totalEspanol: espanolCount,
          langData: langData,
        });
        setLoading(false);
      },
      error: (err) => {
        console.error("Error parsing CSV:", err);
        setError("Error parsing the CSV file");
        setLoading(false);
      },
    });
  };

  // Cargar CSV automáticamente desde GitHub
  React.useEffect(() => {
    const fetchCSV = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/julian-rosas/Customer_Happy_Index_Project/main/tweets_limpios_completos_ner_sentiment_final.csv"
        );
        if (!response.ok) {
          throw new Error("Could not load the CSV file");
        }
        const csvText = await response.text();
        processCSV(csvText);
      } catch (err) {
        console.error("Error fetching CSV:", err);
        setError("Error loading data from GitHub");
        setLoading(false);
      }
    };

    fetchCSV();
  }, []);

  const getColorByLang = (langA, langE) => {
    if (langA > langE) return "#f59e0b";
    if (langE > langA) return "#ec4899";
    return "#6366f1";
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div
          style={{
            background: "white",
            padding: "1rem",
            borderRadius: "0.75rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            border: "2px solid #e5e7eb",
            maxWidth: "320px",
          }}
        >
          <p
            style={{
              fontWeight: "bold",
              marginBottom: "0.75rem",
              fontSize: "1.1rem",
              color: "#1e293b",
            }}
          >
            {d.topic}
          </p>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#64748b",
              marginBottom: "0.25rem",
            }}
          >
            Total tweets: <strong>{d.total}</strong>
          </p>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#64748b",
              marginBottom: "0.25rem",
            }}
          >
            🇩🇪 German: <strong>{d.langA}</strong>
          </p>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#64748b",
              marginBottom: "0.25rem",
            }}
          >
            🇪🇸 Spanish: <strong>{d.langE}</strong>
          </p>
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Sentiment:{" "}
            <strong style={{ color: "#6366f1" }}>
              {d.avgSentiment.toFixed(3)}
            </strong>
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "#3b82f6",
              marginTop: "0.5rem",
              fontWeight: "500",
            }}
          >
            👆 Click on a bubble to see topic details
          </p>
        </div>
      );
    }
    return null;
  };

  const handleBubbleClick = (data) => {
    setSelectedTopic(data);
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
        padding: "2rem",
        fontFamily:
          '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontSize: "2.75rem",
              fontWeight: "800",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "0.5rem",
              letterSpacing: "-0.02em",
            }}
          >
            Topic Analysis by Sentiment
          </h1>
          <p
            style={{
              color: "#64748b",
              fontSize: "1.125rem",
              fontWeight: "400",
              letterSpacing: "0.01em",
            }}
          >
            Interactive visualization of clusters and sources
          </p>
        </div>

        {!data.length ? (
          <div
            style={{
              background: "white",
              borderRadius: "1.5rem",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
              padding: "3rem",
              textAlign: "center",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          ></div>
        ) : (
          <>
            {/* Stats Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1.5rem",
                marginBottom: "2rem",
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                  padding: "1.75rem",
                  borderRadius: "1.25rem",
                  color: "white",
                  boxShadow: "0 8px 20px rgba(59, 130, 246, 0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    opacity: 0.95,
                    marginBottom: "0.5rem",
                    fontWeight: "600",
                    letterSpacing: "0.02em",
                  }}
                >
                  Total Topics
                </div>
                <div
                  style={{
                    fontSize: "2.75rem",
                    fontWeight: "800",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {stats.totalTopics}
                </div>
              </div>
              <div
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  padding: "1.75rem",
                  borderRadius: "1.25rem",
                  color: "white",
                  boxShadow: "0 8px 20px rgba(16, 185, 129, 0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    opacity: 0.95,
                    marginBottom: "0.5rem",
                    fontWeight: "600",
                    letterSpacing: "0.02em",
                  }}
                >
                  Total Tweets
                </div>
                <div
                  style={{
                    fontSize: "2.75rem",
                    fontWeight: "800",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {stats.totalTweets}
                </div>
              </div>
              <div
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                  padding: "1.75rem",
                  borderRadius: "1.25rem",
                  color: "white",
                  boxShadow: "0 8px 20px rgba(139, 92, 246, 0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    opacity: 0.95,
                    marginBottom: "0.5rem",
                    fontWeight: "600",
                    letterSpacing: "0.02em",
                  }}
                >
                  Sentiment Range
                </div>
                <div
                  style={{
                    fontSize: "2.75rem",
                    fontWeight: "800",
                    letterSpacing: "-0.03em",
                  }}
                >
                  -1 a +1
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  window.innerWidth > 1024 ? "2fr 1fr" : "1fr",
                gap: "1.5rem",
                marginBottom: "2rem",
              }}
            >
              {/* Scatter Chart */}
              <div
                style={{
                  background: "white",
                  borderRadius: "1.25rem",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  padding: "1.75rem",
                }}
              >
                <h3
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    marginBottom: "1rem",
                    color: "#1e293b",
                    letterSpacing: "-0.01em",
                  }}
                >
                  📊 Cluster Distribution
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#64748b",
                    marginBottom: "1rem",
                    fontWeight: "400",
                  }}
                >
                  Click on a bubble to see topic details
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 1rem",
                      background: "#fff7ed",
                      borderRadius: "2rem",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: "#f59e0b",
                      }}
                    ></div>
                    <span>🇩🇪 German is Dominant</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 1rem",
                      background: "#fdf2f8",
                      borderRadius: "2rem",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: "#ec4899",
                      }}
                    ></div>
                    <span>🇪🇸 Spanish is Dominant</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 1rem",
                      background: "#eef2ff",
                      borderRadius: "2rem",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: "#6366f1",
                      }}
                    ></div>
                    <span>Balanced</span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart
                    margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      dataKey="avgSentiment"
                      name="Sentiment"
                      domain={[-1, 1]}
                      label={{
                        value: "Sentiment Score Average",
                        position: "bottom",
                        offset: 40,
                      }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      type="number"
                      dataKey="yPosition"
                      name="Topic"
                      domain={[0, "dataMax + 1"]}
                      tick={false}
                      label={{
                        value: "Topics",
                        angle: -90,
                        position: "left",
                        offset: 40,
                      }}
                      stroke="#6b7280"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter
                      data={data}
                      onClick={handleBubbleClick}
                      style={{ cursor: "pointer" }}
                    >
                      {data.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={getColorByLang(entry.langA, entry.langE)}
                          fillOpacity={
                            selectedTopic?.topicId === entry.topicId ? 1 : 0.7
                          }
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Charts */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div
                  style={{
                    background: "white",
                    borderRadius: "1.25rem",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    padding: "1.75rem",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "700",
                      marginBottom: "1rem",
                      color: "#1e293b",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    📍 Data Source
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {sourceData.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.75rem",
                        background: "#eff6ff",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <span>📧 Emails</span>
                      <strong
                        style={{ color: "#3b82f6", fontSize: "1.125rem" }}
                      >
                        {stats.totalCorreos}
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.75rem",
                        background: "#f0fdf4",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <span>🐦 Tweets</span>
                      <strong
                        style={{ color: "#10b981", fontSize: "1.125rem" }}
                      >
                        {stats.totalTweetsSource}
                      </strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "white",
                    borderRadius: "1.25rem",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    padding: "1.75rem",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "700",
                      marginBottom: "1rem",
                      color: "#1e293b",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    🌍 Language Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={stats.langData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {stats.langData.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.75rem",
                        background: "#fff7ed",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <span>🇩🇪 German</span>
                      <strong
                        style={{ color: "#f59e0b", fontSize: "1.125rem" }}
                      >
                        {stats.totalAleman}
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.75rem",
                        background: "#fdf2f8",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <span>🇪🇸 Spanish</span>
                      <strong
                        style={{ color: "#ec4899", fontSize: "1.125rem" }}
                      >
                        {stats.totalEspanol}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Topic Details */}
            {selectedTopic && (
              <div
                style={{
                  background: "white",
                  borderRadius: "1.25rem",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                  padding: "2rem",
                  marginBottom: "2rem",
                  border: "3px solid #6366f1",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "1.5rem",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "2rem",
                      fontWeight: "800",
                      color: "#1e293b",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {selectedTopic.topic}
                  </h3>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    style={{
                      background: "#f1f5f9",
                      border: "none",
                      borderRadius: "0.5rem",
                      padding: "0.5rem",
                      cursor: "pointer",
                      color: "#64748b",
                    }}
                  >
                    <X style={{ width: "24px", height: "24px" }} />
                  </button>
                </div>

                {/* Stats Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      window.innerWidth > 768 ? "1fr 1fr" : "1fr",
                    gap: "1.5rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #eff6ff, #eef2ff)",
                      padding: "1.5rem",
                      borderRadius: "1rem",
                    }}
                  >
                    <h4
                      style={{
                        fontWeight: "700",
                        marginBottom: "1rem",
                        fontSize: "1.125rem",
                        color: "#1e293b",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      📈 Statistics
                    </h4>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: "#334155",
                        lineHeight: "1.8",
                        fontWeight: "400",
                      }}
                    >
                      <p>
                        <strong style={{ fontWeight: "600" }}>
                          Total tweets:
                        </strong>{" "}
                        {selectedTopic.total}
                      </p>
                      <p>
                        <strong style={{ fontWeight: "600" }}>
                          🇩🇪 German:
                        </strong>{" "}
                        {selectedTopic.langA} (
                        {(
                          (selectedTopic.langA / selectedTopic.total) *
                          100
                        ).toFixed(1)}
                        %)
                      </p>
                      <p>
                        <strong style={{ fontWeight: "600" }}>
                          🇪🇸 Spanish:
                        </strong>{" "}
                        {selectedTopic.langE} (
                        {(
                          (selectedTopic.langE / selectedTopic.total) *
                          100
                        ).toFixed(1)}
                        %)
                      </p>
                      <p>
                        <strong style={{ fontWeight: "600" }}>
                          Average Sentiment:
                        </strong>{" "}
                        <span
                          style={{
                            fontSize: "1.25rem",
                            color: "#6366f1",
                            fontWeight: "800",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {selectedTopic.avgSentiment.toFixed(3)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "linear-gradient(135deg, #fdf4ff, #fae8ff)",
                      padding: "1.5rem",
                      borderRadius: "1rem",
                    }}
                  >
                    <h4
                      style={{
                        fontWeight: "700",
                        marginBottom: "1rem",
                        fontSize: "1.125rem",
                        color: "#1e293b",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      🔑 Keywords
                    </h4>
                    {selectedTopic.keywords ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        {selectedTopic.keywords.split(",").map((kw, i) => (
                          <span
                            key={i}
                            style={{
                              padding: "0.5rem 1rem",
                              background:
                                "linear-gradient(135deg, #e0e7ff, #ddd6fe)",
                              color: "#4f46e5",
                              borderRadius: "2rem",
                              fontSize: "0.875rem",
                              fontWeight: "600",
                              letterSpacing: "0.01em",
                            }}
                          >
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: "#9ca3af", fontStyle: "italic" }}>
                        Not available
                      </p>
                    )}
                  </div>
                </div>

                {/* Representative Tweet */}
                {selectedTopic.repTweet && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #eef2ff, #dbeafe)",
                      padding: "1.5rem",
                      borderRadius: "1rem",
                      borderLeft: "4px solid #6366f1",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <h4
                      style={{
                        fontWeight: "700",
                        marginBottom: "0.75rem",
                        fontSize: "1.125rem",
                        color: "#1e293b",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      ✨ Representative Text
                    </h4>
                    <p
                      style={{
                        fontStyle: "italic",
                        lineHeight: "1.7",
                        color: "#334155",
                        fontSize: "1rem",
                      }}
                    >
                      "{selectedTopic.repTweet}"
                    </p>
                  </div>
                )}

                {/* Sample Tweets */}
                <div>
                  <h4
                    style={{
                      fontWeight: "700",
                      marginBottom: "1rem",
                      fontSize: "1.125rem",
                      color: "#1e293b",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    💬 Sample Text (showing{" "}
                    {Math.min(5, selectedTopic.tweets.length)} de{" "}
                    {selectedTopic.tweets.length})
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {selectedTopic.tweets.slice(0, 5).map((t, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#f8fafc",
                          padding: "1.25rem",
                          borderRadius: "0.75rem",
                          borderLeft: "3px solid #cbd5e1",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          transition: "all 0.2s",
                        }}
                      >
                        <p
                          style={{
                            color: "#334155",
                            lineHeight: "1.6",
                            marginBottom: "0.75rem",
                            fontSize: "0.95rem",
                          }}
                        >
                          {t.text}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: "1rem",
                            fontSize: "0.8rem",
                            color: "#64748b",
                          }}
                        >
                          <span
                            style={{
                              background: "white",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.5rem",
                              fontWeight: "500",
                            }}
                          >
                            <strong style={{ fontWeight: "600" }}>
                              Sentiment:
                            </strong>{" "}
                            {t.sentiment?.toFixed(3)}
                          </span>
                          <span
                            style={{
                              background: "white",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.5rem",
                              fontWeight: "500",
                            }}
                          >
                            <strong style={{ fontWeight: "600" }}>
                              Language:
                            </strong>{" "}
                            {t.lang === "A" ? "🇩🇪 German" : "🇪🇸 Spanish"}
                          </span>
                          {t.fuente === "C" && (
                            <span
                              style={{
                                background: "#eff6ff",
                                color: "#3b82f6",
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.5rem",
                                fontWeight: "600",
                              }}
                            >
                              📧 Email
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
