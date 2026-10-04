import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "https://smart-resume-api-app.onrender.com");

function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("analyzer");

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);

      const response = await fetch(`${API_BASE_URL}/history`);

      if (!response.ok) {
        throw new Error("Could not load analysis history.");
      }

      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleAnalyze = async () => {
    if (!resumeFile) {
      setError("Please upload your resume PDF.");
      return;
    }

    if (
      resumeFile.type !== "application/pdf" &&
      !resumeFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF resume files are allowed.");
      return;
    }

    if (!jobDescription.trim()) {
      setError("Please enter the job description.");
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError(
        "Job description is too short. Please enter a complete job description."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", resumeFile);

      const resumeResponse = await fetch(
        `${API_BASE_URL}/upload-resume`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!resumeResponse.ok) {
        const errorData = await resumeResponse.json().catch(() => null);

        throw new Error(
          errorData?.detail || "Resume upload failed."
        );
      }

      const resumeData = await resumeResponse.json();

      if (!resumeData.text || !resumeData.text.trim()) {
        throw new Error(
          "Could not extract text from this PDF. Please upload a text-based resume PDF."
        );
      }

      const analyzeResponse = await fetch(
        `${API_BASE_URL}/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resume_text: resumeData.text,
            job_description: jobDescription,
            resume_filename: resumeFile.name,
          }),
        }
      );

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json().catch(() => null);

        throw new Error(
          errorData?.detail || "Resume analysis failed."
        );
      }

      const analysisData = await analyzeResponse.json();

      setResult(analysisData);

      await loadHistory();
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/history/${id}`
      );

      if (!response.ok) {
        throw new Error("Could not load analysis details.");
      }

      const data = await response.json();

      setResult(data);
      setActiveTab("analyzer");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this analysis?"
    );

    if (!confirmDelete) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/history/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Could not delete analysis.");
      }

      await loadHistory();

      if (result && result.id === id) {
        setResult(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Date unavailable";

    return new Date(dateString).toLocaleString();
  };

  const totalAnalyses = history.length;

  const averageMatch =
    totalAnalyses > 0
      ? (
          history.reduce(
            (sum, item) =>
              sum + Number(item.match_percentage || 0),
            0
          ) / totalAnalyses
        ).toFixed(2)
      : 0;

  const highestMatch =
    totalAnalyses > 0
      ? Math.max(
          ...history.map((item) =>
            Number(item.match_percentage || 0)
          )
        ).toFixed(2)
      : 0;

  const missingSkillCount = {};

  history.forEach((item) => {
    if (!item.missing_skills) return;

    const skills = item.missing_skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    skills.forEach((skill) => {
      missingSkillCount[skill] =
        (missingSkillCount[skill] || 0) + 1;
    });
  });

  const commonMissingSkills = Object.entries(
    missingSkillCount
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const downloadPDF = () => {
    if (!result) {
      setError("Please analyze a resume first.");
      return;
    }

    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let y = 20;

    const addWrappedText = (
      text,
      x,
      yPosition,
      maxWidth = 180,
      lineHeight = 6
    ) => {
      const safeText = String(text || "");

      const lines = doc.splitTextToSize(
        safeText,
        maxWidth
      );

      for (const line of lines) {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }

        doc.text(line, x, yPosition);
        yPosition += lineHeight;
      }

      return yPosition;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);

    doc.text(
      "AI Resume Analyzer",
      pageWidth / 2,
      y,
      { align: "center" }
    );

    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    doc.text(
      "Resume Analysis Report",
      pageWidth / 2,
      y,
      { align: "center" }
    );

    y += 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(
      "Resume Information",
      15,
      y
    );

    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    y = addWrappedText(
      `Resume: ${
        result.resume_filename ||
        resumeFile?.name ||
        "Resume"
      }`,
      15,
      y
    );

    if (result.created_at) {
      y = addWrappedText(
        `Analysis Date: ${formatDate(
          result.created_at
        )}`,
        15,
        y
      );
    }

    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(
      "Analysis Scores",
      15,
      y
    );

    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    y = addWrappedText(
      `Resume Match: ${
        result.match_percentage ?? 0
      }%`,
      15,
      y
    );

    y = addWrappedText(
      `ATS Score: ${
        result.ats_score ?? "N/A"
      }%`,
      15,
      y
    );

    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(
      "Matched Skills",
      15,
      y
    );

    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const matchedSkills =
      result.matched_skills || [];

    if (matchedSkills.length > 0) {
      y = addWrappedText(
        matchedSkills.join(", "),
        15,
        y
      );
    } else {
      y = addWrappedText(
        "No matched skills found.",
        15,
        y
      );
    }

    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(
      "Missing Skills",
      15,
      y
    );

    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const missingSkills =
      result.missing_skills || [];

    if (missingSkills.length > 0) {
      y = addWrappedText(
        missingSkills.join(", "),
        15,
        y
      );
    } else {
      y = addWrappedText(
        "No major missing skills found.",
        15,
        y
      );
    }

    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(
      "Skill Gap Analysis",
      15,
      y
    );

    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    if (missingSkills.length > 0) {
      missingSkills.forEach((skill) => {
        y = addWrappedText(
          `• ${skill}`,
          15,
          y
        );
      });
    } else {
      y = addWrappedText(
        "No significant skill gaps detected.",
        15,
        y
      );
    }

    y += 7;

    if (result.job_description) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);

      doc.text(
        "Job Description",
        15,
        y
      );

      y += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      y = addWrappedText(
        result.job_description,
        15,
        y,
        180,
        5
      );

      y += 7;
    }

    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text(
      "AI Career Analysis",
      15,
      y
    );

    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let aiText =
      result.ai_analysis ||
      "No AI analysis available.";

    aiText = aiText
      .replace(/#{1,6}\s?/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "");

    y = addWrappedText(
      aiText,
      15,
      y,
      180,
      5
    );

    const totalPages =
      doc.internal.getNumberOfPages();

    for (
      let page = 1;
      page <= totalPages;
      page++
    ) {
      doc.setPage(page);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      doc.text(
        `AI Resume Analyzer | Page ${page} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    }

    let filename =
      result.resume_filename ||
      "resume";

    filename = filename
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9\_-]/g, "_");

    doc.save(
      `${filename}_analysis_report.pdf`
    );
  };

  const getGapPercentage = () => {
    return 100;
  };

  const getScoreLabel = (score) => {
    const value = Number(score || 0);

    if (value >= 80) return "Excellent Match";
    if (value >= 60) return "Good Match";
    if (value >= 40) return "Moderate Match";

    return "Needs Improvement";
  };

  return (
    <div className="app">

      {/* ================= HEADER ================= */}

      <header className="header">
        <div>
          <h1>AI Resume Analyzer</h1>

          <p>
            Analyze your resume against a job description
            using AI-powered skill matching.
          </p>
        </div>
      </header>

      {/* ================= NAVIGATION ================= */}

      <nav className="navbar">

        <button
          className={
            activeTab === "analyzer"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab("analyzer")
          }
        >
          Resume Analyzer
        </button>

        <button
          className={
            activeTab === "dashboard"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab("dashboard")
          }
        >
          Dashboard
        </button>

        <button
          className={
            activeTab === "history"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab("history")
          }
        >
          Analysis History
        </button>

      </nav>

      <main className="container">

        {/* =================================================
            ANALYZER
        ================================================= */}

        {activeTab === "analyzer" && (
          <>

            {/* Resume Upload */}

            <section className="card">

              <h2>1. Upload Resume</h2>

              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {

                  const selectedFile =
                    e.target.files[0];

                  setError("");

                  if (!selectedFile) {
                    setResumeFile(null);
                    return;
                  }

                  if (
                    selectedFile.type !==
                      "application/pdf" &&
                    !selectedFile.name
                      .toLowerCase()
                      .endsWith(".pdf")
                  ) {
                    setResumeFile(null);

                    setError(
                      "Only PDF resume files are allowed."
                    );

                    e.target.value = "";

                    return;
                  }

                  setResumeFile(
                    selectedFile
                  );
                }}
              />

              {resumeFile && (
                <p className="file-name">
                  Selected: {resumeFile.name}
                </p>
              )}

            </section>

            {/* Job Description */}

            <section className="card">

              <div className="jd-header">

                <div>
                  <h2>
                    2. Job Description
                  </h2>

                  <p className="jd-hint">
                    Paste the complete job description
                    you want to compare your resume with.
                  </p>
                </div>

                <span className="jd-counter">
                  {jobDescription.length} characters
                </span>

              </div>

              <textarea
                value={jobDescription}
                onChange={(e) => {

                  setJobDescription(
                    e.target.value
                  );

                  setError("");
                }}
                placeholder="Example: We are looking for a Data Engineer with experience in Python, SQL, ETL, AWS, Spark, and data pipelines..."
                rows="10"
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "8px",
                  gap: "10px",
                }}
              >

                <span
                  style={{
                    color:
                      jobDescription.trim()
                        .length >= 50
                        ? "#15803d"
                        : "#667085",
                    fontSize: "13px",
                  }}
                >
                  {jobDescription.trim()
                    .length >= 50
                    ? "✓ Ready for analysis"
                    : "Minimum 50 characters required"}
                </span>

              </div>

            </section>

            {/* Analyze */}

            <button
              className="analyze-button"
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading
                ? "Analyzing Resume..."
                : "Analyze Resume"}
            </button>

            {/* Error */}

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            {/* =================================================
                RESULTS
            ================================================= */}

            {result && (
              <section className="results">

                {/* Result Header */}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "15px",
                    flexWrap: "wrap",
                    marginBottom: "22px",
                  }}
                >

                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "28px",
                      }}
                    >
                      Analysis Result
                    </h2>

                    <p
                      style={{
                        margin: "5px 0 0",
                        color: "#667085",
                      }}
                    >
                      Here's how your resume matches
                      the selected job.
                    </p>
                  </div>

                  <button
                    className="analyze-button"
                    onClick={downloadPDF}
                    style={{
                      width: "auto",
                      margin: 0,
                    }}
                  >
                    📄 Download Report
                  </button>

                </div>

                {/* Resume Information */}

                <div className="result-card">

                  <h3>
                    Resume Information
                  </h3>

                  <p>
                    <strong>File:</strong>{" "}
                    {result.resume_filename ||
                      resumeFile?.name ||
                      "Resume"}
                  </p>

                  {result.created_at && (
                    <p>
                      <strong>Analyzed:</strong>{" "}
                      {formatDate(
                        result.created_at
                      )}
                    </p>
                  )}

                </div>

                {/* Scores */}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "20px",
                    marginBottom: "22px",
                  }}
                >

                  {/* Resume Match */}

                  <div className="match-card">

                    <h3>
                      Resume Match
                    </h3>

                    <div className="percentage">
                      {result.match_percentage}%
                    </div>

                    <div
                      style={{
                        color: "#6d28d9",
                        fontWeight: 700,
                        marginBottom: "15px",
                      }}
                    >
                      {getScoreLabel(
                        result.match_percentage
                      )}
                    </div>

                    <div className="progress-bar">

                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(
                            Number(
                              result.match_percentage ||
                                0
                            ),
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <p className="match-text">
                      How closely your resume
                      matches the job requirements.
                    </p>

                  </div>

                  {/* ATS */}

                  <div className="match-card">

                    <h3>
                      ATS Score
                    </h3>

                    <div className="percentage">
                      {result.ats_score ??
                        "N/A"}
                      {result.ats_score != null &&
                        "%"}
                    </div>

                    <div
                      style={{
                        color: "#6d28d9",
                        fontWeight: 700,
                        marginBottom: "15px",
                      }}
                    >
                      Resume Screening Score
                    </div>

                    <div className="progress-bar">

                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(
                            Number(
                              result.ats_score || 0
                            ),
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <p className="match-text">
                      Based on skill match, resume
                      sections and text completeness.
                    </p>

                  </div>

                </div>

                {/* Skill Summary */}

                <div className="skills-summary">

                  <div className="skill-count matched-count">

                    <span className="count-number">
                      {result.matched_skills
                        ?.length || 0}
                    </span>

                    <span className="count-label">
                      Matched Skills
                    </span>

                  </div>

                  <div className="skill-count missing-count">

                    <span className="count-number">
                      {result.missing_skills
                        ?.length || 0}
                    </span>

                    <span className="count-label">
                      Missing Skills
                    </span>

                  </div>

                </div>

                {/* Matched Skills */}

                <div className="result-card">

                  <div className="section-title">

                    <div>

                      <h3>
                        ✓ Matched Skills
                      </h3>

                      <p>
                        Skills detected in both
                        your resume and the job
                        description.
                      </p>

                    </div>

                    <span className="skill-total matched-total">
                      {result.matched_skills
                        ?.length || 0}
                    </span>

                  </div>

                  <div className="skills">

                    {result.matched_skills?.length >
                    0 ? (
                      result.matched_skills.map(
                        (skill) => (
                          <span
                            className="skill matched"
                            key={skill}
                          >
                            ✓ {skill}
                          </span>
                        )
                      )
                    ) : (
                      <p>
                        No matched skills found.
                      </p>
                    )}

                  </div>

                </div>

                {/* Missing Skills */}

                <div className="result-card">

                  <div className="section-title">

                    <div>

                      <h3>
                        ⚠ Missing Skills
                      </h3>

                      <p>
                        Skills required by the job
                        but not detected in your
                        resume.
                      </p>

                    </div>

                    <span className="skill-total missing-total">
                      {result.missing_skills
                        ?.length || 0}
                    </span>

                  </div>

                  <div className="skills">

                    {result.missing_skills?.length >
                    0 ? (
                      result.missing_skills.map(
                        (skill) => (
                          <span
                            className="skill missing"
                            key={skill}
                          >
                            {skill}
                          </span>
                        )
                      )
                    ) : (
                      <p>
                        No major missing skills
                        found.
                      </p>
                    )}

                  </div>

                </div>

                {/* Skill Gap */}

                <div className="result-card">

                  <h3>
                    📊 Skill Gap Analysis
                  </h3>

                  <p>
                    Skills required by the job
                    that are currently missing
                    from your resume.
                  </p>

                  {result.missing_skills?.length >
                  0 ? (
                    <div
                      style={{
                        marginTop: "20px",
                      }}
                    >

                      {result.missing_skills.map(
                        (skill) => (
                          <div
                            key={skill}
                            style={{
                              marginBottom:
                                "16px",
                            }}
                          >

                            <div
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                marginBottom:
                                  "6px",
                              }}
                            >

                              <strong>
                                {skill}
                              </strong>

                              <span>
                                Skill Gap
                              </span>

                            </div>

                            <div
                              style={{
                                width: "100%",
                                height: "9px",
                                background:
                                  "#eaecf0",
                                borderRadius:
                                  "10px",
                                overflow:
                                  "hidden",
                              }}
                            >

                              <div
                                style={{
                                  width: `${getGapPercentage()}%`,
                                  height: "100%",
                                  background:
                                    "#ea580c",
                                  borderRadius:
                                    "10px",
                                }}
                              />

                            </div>

                          </div>
                        )
                      )}

                    </div>
                  ) : (
                    <p>
                      No skill gaps detected.
                    </p>
                  )}

                </div>

                {/* Explainable Matching */}

                {result.related_matches &&
                  result.related_matches.length >
                    0 && (

                    <div className="result-card">

                      <h3>
                        🔎 Explainable Skill
                        Matching
                      </h3>

                      <p>
                        Related skills detected
                        by the analyzer.
                      </p>

                      <div
                        style={{
                          marginTop: "15px",
                        }}
                      >

                        {result.related_matches.map(
                          (item, index) => {

                            let skillName = "";
                            let matchedWith = "";

                            if (
                              typeof item ===
                              "string"
                            ) {
                              skillName = item;
                            } else {

                              skillName =
                                item.skill ||
                                item.resume_skill ||
                                item.name ||
                                `Match ${
                                  index + 1
                                }`;

                              matchedWith =
                                item.matched_with ||
                                item.related_to ||
                                item.job_skill ||
                                "";
                            }

                            return (
                              <div
                                key={index}
                                style={{
                                  padding: "13px",
                                  marginBottom:
                                    "10px",
                                  borderRadius:
                                    "9px",
                                  background:
                                    "#f8f9fc",
                                  border:
                                    "1px solid #e2e8f0",
                                }}
                              >

                                <strong>
                                  {skillName}
                                </strong>

                                {matchedWith && (
                                  <span>
                                    {" "}
                                    → related to{" "}
                                    <strong>
                                      {matchedWith}
                                    </strong>
                                  </span>
                                )}

                              </div>
                            );
                          }
                        )}

                      </div>

                    </div>
                  )}

                {/* Job Description */}

                {result.job_description && (
                  <div className="result-card">

                    <h3>
                      📄 Job Description
                    </h3>

                    <div
                      style={{
                        maxHeight: "260px",
                        overflowY: "auto",
                        padding: "16px",
                        marginTop: "12px",
                        background: "#f8f9fc",
                        border:
                          "1px solid #eaecf0",
                        borderRadius: "9px",
                        whiteSpace: "pre-wrap",
                        color: "#475467",
                        lineHeight: 1.7,
                      }}
                    >
                      {result.job_description}
                    </div>

                  </div>
                )}

                {/* AI Recommendations */}

                <div className="result-card">

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >

                    <div>

                      <h3>
                        🤖 AI Career
                        Recommendations
                      </h3>

                      <p
                        style={{
                          marginTop: "4px",
                        }}
                      >
                        Personalized guidance based
                        on your resume and target job.
                      </p>

                    </div>

                    <span
                      style={{
                        padding:
                          "6px 11px",
                        borderRadius:
                          "999px",
                        background:
                          "#ede9fe",
                        color:
                          "#6d28d9",
                        fontSize:
                          "12px",
                        fontWeight:
                          700,
                      }}
                    >
                      AI Powered
                    </span>

                  </div>

                  <div className="ai-analysis">

                    <ReactMarkdown>
                      {result.ai_analysis ||
                        "No AI analysis available."}
                    </ReactMarkdown>

                  </div>

                </div>

              </section>
            )}

          </>
        )}

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {activeTab === "dashboard" && (

          <section className="dashboard">

            <div className="dashboard-header">

              <div>

                <h2>
                  Dashboard
                </h2>

                <p>
                  Overview of your resume
                  analyses.
                </p>

              </div>

              <button
                className="refresh-button"
                onClick={loadHistory}
              >
                ↻ Refresh
              </button>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <div className="stat-icon">
                  📊
                </div>

                <div>

                  <p>
                    Total Analyses
                  </p>

                  <h3>
                    {totalAnalyses}
                  </h3>

                </div>

              </div>

              <div className="stat-card">

                <div className="stat-icon">
                  📈
                </div>

                <div>

                  <p>
                    Average Match
                  </p>

                  <h3>
                    {averageMatch}%
                  </h3>

                </div>

              </div>

              <div className="stat-card">

                <div className="stat-icon">
                  🏆
                </div>

                <div>

                  <p>
                    Highest Match
                  </p>

                  <h3>
                    {highestMatch}%
                  </h3>

                </div>

              </div>

            </div>

            <div className="dashboard-card">

              <div className="dashboard-card-header">

                <h3>
                  Common Missing Skills
                </h3>

                <p>
                  Skills frequently missing
                  across analyzed jobs.
                </p>

              </div>

              {historyLoading ? (

                <p>
                  Loading dashboard...
                </p>

              ) : commonMissingSkills.length >
                0 ? (

                <div className="common-skills">

                  {commonMissingSkills.map(
                    ([skill, count]) => (

                      <div
                        className="common-skill-row"
                        key={skill}
                      >

                        <span>
                          {skill}
                        </span>

                        <span className="skill-frequency">
                          {count}{" "}
                          {count === 1
                            ? "analysis"
                            : "analyses"}
                        </span>

                      </div>

                    )
                  )}

                </div>

              ) : (

                <div className="empty-state">

                  <p>
                    No missing-skill data
                    available yet.
                  </p>

                  <p>
                    Analyze a few resumes to
                    see common skill gaps here.
                  </p>

                </div>

              )}

            </div>

          </section>

        )}

        {/* =================================================
            HISTORY
        ================================================= */}

        {activeTab === "history" && (

          <section className="history-section">

            <div className="dashboard-header">

              <div>

                <h2>
                  Analysis History
                </h2>

                <p>
                  View and manage your previous
                  resume analyses.
                </p>

              </div>

              <button
                className="refresh-button"
                onClick={loadHistory}
              >
                ↻ Refresh
              </button>

            </div>

            {historyLoading ? (

              <div className="empty-state">

                <p>
                  Loading history...
                </p>

              </div>

            ) : history.length === 0 ? (

              <div className="empty-state">

                <h3>
                  No analyses yet
                </h3>

                <p>
                  Go to Resume Analyzer and
                  analyze your first resume.
                </p>

              </div>

            ) : (

              <div className="history-list">

                {history.map((item) => {

                  const matchedSkills =
                    item.matched_skills
                      ? item.matched_skills
                          .split(",")
                          .map((skill) =>
                            skill.trim()
                          )
                          .filter(Boolean)
                      : [];

                  const missingSkills =
                    item.missing_skills
                      ? item.missing_skills
                          .split(",")
                          .map((skill) =>
                            skill.trim()
                          )
                          .filter(Boolean)
                      : [];

                  return (

                    <div
                      className="history-card"
                      key={item.id}
                    >

                      <div className="history-top">

                        <div>

                          <span className="analysis-number">
                            Analysis #{item.id}
                          </span>

                          <h3>
                            {item.resume_filename ||
                              "Resume Analysis"}
                          </h3>

                          {item.created_at && (
                            <small>
                              {formatDate(
                                item.created_at
                              )}
                            </small>
                          )}

                        </div>

                        <div className="history-match">
                          {item.match_percentage}%
                        </div>

                      </div>

                      <div className="history-progress">

                        <div
                          style={{
                            width: `${Math.min(
                              Number(
                                item.match_percentage ||
                                  0
                              ),
                              100
                            )}%`,
                          }}
                        />

                      </div>

                      {item.job_description && (

                        <div
                          style={{
                            marginTop: "15px",
                            padding: "13px",
                            background:
                              "#f8f9fc",
                            border:
                              "1px solid #eaecf0",
                            borderRadius:
                              "8px",
                          }}
                        >

                          <strong>
                            Job Description:
                          </strong>

                          <p
                            style={{
                              marginBottom: 0,
                            }}
                          >
                            {item.job_description
                              .length > 250
                              ? `${item.job_description.slice(
                                  0,
                                  250
                                )}...`
                              : item.job_description}
                          </p>

                        </div>

                      )}

                      <div className="history-skills">

                        <div>

                          <strong>
                            Matched:
                          </strong>

                          {matchedSkills.length >
                          0
                            ? matchedSkills.join(
                                ", "
                              )
                            : " None"}

                        </div>

                        <div>

                          <strong>
                            Missing:
                          </strong>

                          {missingSkills.length >
                          0
                            ? missingSkills.join(
                                ", "
                              )
                            : " None"}

                        </div>

                      </div>

                      <div className="history-actions">

                        <button
                          className="view-button"
                          onClick={() =>
                            handleViewDetails(
                              item.id
                            )
                          }
                        >
                          View Details
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            handleDelete(
                              item.id
                            )
                          }
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  );
                })}

              </div>

            )}

          </section>

        )}

      </main>

    </div>
  );
}

export default App;