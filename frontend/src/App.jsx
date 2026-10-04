import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8000";

function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("analyzer");

  // =========================
  // LOAD HISTORY
  // =========================

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/history`
      );

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

  // =========================
  // ANALYZE RESUME
  // =========================

  const handleAnalyze = async () => {
    // Resume validation
    if (!resumeFile) {
      setError("Please upload your resume PDF.");
      return;
    }

    // PDF validation
    if (
      resumeFile.type !== "application/pdf" &&
      !resumeFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF resume files are allowed.");
      return;
    }

    // Job description validation
    if (!jobDescription.trim()) {
      setError("Please enter the job description.");
      return;
    }

    // Minimum JD validation
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
      // =========================
      // UPLOAD RESUME
      // =========================

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
        const errorData =
          await resumeResponse.json().catch(() => null);

        throw new Error(
          errorData?.detail ||
            "Resume upload failed."
        );
      }

      const resumeData =
        await resumeResponse.json();

      // Check extracted resume text
      if (
        !resumeData.text ||
        !resumeData.text.trim()
      ) {
        throw new Error(
          "Could not extract text from this PDF. Please upload a text-based resume PDF."
        );
      }

      // =========================
      // ANALYZE RESUME
      // =========================

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
        const errorData =
          await analyzeResponse.json().catch(() => null);

        throw new Error(
          errorData?.detail ||
            "Resume analysis failed."
        );
      }

      const analysisData =
        await analyzeResponse.json();

      setResult(analysisData);

      await loadHistory();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Something went wrong. Please try again."
      );

    } finally {
      setLoading(false);
    }
  };

  // =========================
  // VIEW HISTORY DETAILS
  // =========================

  const handleViewDetails = async (id) => {
    try {
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/history/${id}`
      );

      if (!response.ok) {
        throw new Error(
          "Could not load analysis details."
        );
      }

      const data = await response.json();

      setResult(data);

      setActiveTab("analyzer");

    } catch (err) {
      setError(err.message);
    }
  };

  // =========================
  // DELETE HISTORY
  // =========================

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this analysis?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/history/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Could not delete analysis."
        );
      }

      await loadHistory();

      if (result && result.id === id) {
        setResult(null);
      }

    } catch (err) {
      setError(err.message);
    }
  };

  // =========================
  // FORMAT DATE
  // =========================

  const formatDate = (dateString) => {
    if (!dateString) {
      return "Date unavailable";
    }

    return new Date(
      dateString
    ).toLocaleString();
  };

  // =========================
  // DASHBOARD CALCULATIONS
  // =========================

  const totalAnalyses = history.length;

  const averageMatch =
    totalAnalyses > 0
      ? (
          history.reduce(
            (sum, item) =>
              sum +
              Number(
                item.match_percentage || 0
              ),
            0
          ) / totalAnalyses
        ).toFixed(2)
      : 0;

  const highestMatch =
    totalAnalyses > 0
      ? Math.max(
          ...history.map((item) =>
            Number(
              item.match_percentage || 0
            )
          )
        ).toFixed(2)
      : 0;

  // =========================
  // COMMON MISSING SKILLS
  // =========================

  const missingSkillCount = {};

  history.forEach((item) => {
    if (!item.missing_skills) {
      return;
    }

    const skills =
      item.missing_skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);

    skills.forEach((skill) => {
      missingSkillCount[skill] =
        (missingSkillCount[skill] || 0) + 1;
    });
  });

  const commonMissingSkills =
    Object.entries(missingSkillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

  // =========================
  // DOWNLOAD PDF REPORT
  // =========================

  const downloadPDF = () => {
    if (!result) {
      setError(
        "Please analyze a resume first."
      );
      return;
    }

    const doc = new jsPDF();

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    let y = 20;

    // Helper function
    const addWrappedText = (
      text,
      x,
      yPosition,
      maxWidth = 180,
      lineHeight = 6
    ) => {
      const safeText = String(
        text || ""
      );

      const lines =
        doc.splitTextToSize(
          safeText,
          maxWidth
        );

      for (const line of lines) {
        if (
          yPosition >
          pageHeight - 20
        ) {
          doc.addPage();
          yPosition = 20;
        }

        doc.text(
          line,
          x,
          yPosition
        );

        yPosition += lineHeight;
      }

      return yPosition;
    };

    // =========================
    // TITLE
    // =========================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(22);

    doc.text(
      "AI Resume Analyzer",
      pageWidth / 2,
      y,
      {
        align: "center",
      }
    );

    y += 10;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(11);

    doc.text(
      "Resume Analysis Report",
      pageWidth / 2,
      y,
      {
        align: "center",
      }
    );

    y += 15;

    // =========================
    // RESUME INFORMATION
    // =========================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(15);

    doc.text(
      "Resume Information",
      15,
      y
    );

    y += 9;

    doc.setFont(
      "helvetica",
      "normal"
    );

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

    // =========================
    // SCORE SECTION
    // =========================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(15);

    doc.text(
      "Analysis Scores",
      15,
      y
    );

    y += 10;

    doc.setFont(
      "helvetica",
      "normal"
    );

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

    // =========================
    // MATCHED SKILLS
    // =========================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(15);

    doc.text(
      "Matched Skills",
      15,
      y
    );

    y += 9;

    doc.setFont(
      "helvetica",
      "normal"
    );

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

    // =========================
    // MISSING SKILLS
    // =========================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(15);

    doc.text(
      "Missing Skills",
      15,
      y
    );

    y += 9;

    doc.setFont(
      "helvetica",
      "normal"
    );

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

    // =========================
    // SKILL GAP
    // =========================

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(15);

    doc.text(
      "Skill Gap Analysis",
      15,
      y
    );

    y += 9;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(10);

    if (missingSkills.length > 0) {
      missingSkills.forEach(
        (skill) => {
          y = addWrappedText(
            `• ${skill}`,
            15,
            y
          );
        }
      );
    } else {
      y = addWrappedText(
        "No significant skill gaps detected.",
        15,
        y
      );
    }

    y += 7;

    // =========================
    // JOB DESCRIPTION
    // =========================

    if (result.job_description) {
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(15);

      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      doc.text(
        "Job Description",
        15,
        y
      );

      y += 9;

      doc.setFont(
        "helvetica",
        "normal"
      );

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

    // =========================
    // AI ANALYSIS
    // =========================

    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(15);

    doc.text(
      "AI Career Analysis",
      15,
      y
    );

    y += 9;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(9);

    let aiText =
      result.ai_analysis ||
      "No AI analysis available.";

    // Remove markdown symbols
    aiText = aiText
      .replace(
        /#{1,6}\s?/g,
        ""
      )
      .replace(
        /\*\*/g,
        ""
      )
      .replace(
        /\*/g,
        ""
      )
      .replace(
        /`/g,
        ""
      );

    y = addWrappedText(
      aiText,
      15,
      y,
      180,
      5
    );

    // =========================
    // FOOTER
    // =========================

    const totalPages =
      doc.internal.getNumberOfPages();

    for (
      let page = 1;
      page <= totalPages;
      page++
    ) {
      doc.setPage(page);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(8);

      doc.text(
        `AI Resume Analyzer | Page ${page} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        {
          align: "center",
        }
      );
    }

    // =========================
    // SAVE PDF
    // =========================

    let filename =
      result.resume_filename ||
      "resume";

    filename = filename
      .replace(
        /\.pdf$/i,
        ""
      )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

    doc.save(
      `${filename}_analysis_report.pdf`
    );
  };

  // =========================
  // SKILL GAP BAR
  // =========================

  const getGapPercentage = () => {
    return 100;
  };

  // =========================
  // RETURN UI
  // =========================

  return (
    <div className="app">

      {/* ================= HEADER ================= */}

      <header className="header">

        <div>

          <h1>
            AI Resume Analyzer
          </h1>

          <p>
            Analyze your resume against a
            job description using AI.
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

        {/* ================================================= */}
        {/* ANALYZER TAB */}
        {/* ================================================= */}

        {activeTab === "analyzer" && (
          <>

            {/* Upload Resume */}

            <section className="card">

              <h2>
                1. Upload Resume
              </h2>

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

                  // PDF validation immediately
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
                  Selected:{" "}
                  {resumeFile.name}
                </p>
              )}

            </section>

            {/* Job Description */}

            <section className="card">

              <h2>
                2. Job Description
              </h2>

              <textarea
                value={jobDescription}
                onChange={(e) => {

                  setJobDescription(
                    e.target.value
                  );

                  setError("");
                }}
                placeholder="Paste the job description here..."
                rows="10"
              />

              {jobDescription.trim() &&
                jobDescription.trim()
                  .length < 50 && (
                  <p
                    style={{
                      color: "#dc2626",
                      marginTop: "8px",
                    }}
                  >
                    Job description should
                    contain at least 50
                    characters.
                  </p>
                )}

            </section>

            {/* Analyze Button */}

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

            {/* ================================================= */}
            {/* RESULTS */}
            {/* ================================================= */}

            {result && (
              <section className="results">

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: "15px",
                    flexWrap: "wrap",
                    marginBottom: "20px",
                  }}
                >

                  <h2>
                    Analysis Result
                  </h2>

                  <button
                    className="analyze-button"
                    onClick={
                      downloadPDF
                    }
                    style={{
                      margin: 0,
                    }}
                  >
                    📄 Download PDF Report
                  </button>

                </div>

                {/* Resume Information */}

                <div className="result-card">

                  <h3>
                    Resume Information
                  </h3>

                  <p>
                    <strong>
                      File:
                    </strong>{" "}
                    {result.resume_filename ||
                      resumeFile?.name ||
                      "Resume"}
                  </p>

                  {result.created_at && (
                    <p>
                      <strong>
                        Analyzed:
                      </strong>{" "}
                      {formatDate(
                        result.created_at
                      )}
                    </p>
                  )}

                </div>

                {/* SCORE CARDS */}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "20px",
                    marginBottom: "25px",
                  }}
                >

                  {/* Match */}

                  <div className="match-card">

                    <h3>
                      Resume Match
                    </h3>

                    <div className="percentage">
                      {
                        result.match_percentage
                      }%
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
                      Resume-to-job skill
                      match.
                    </p>

                  </div>

                  {/* ATS */}

                  <div className="match-card">

                    <h3>
                      ATS Score
                    </h3>

                    <div className="percentage">
                      {
                        result.ats_score ??
                        "N/A"
                      }%
                    </div>

                    <div className="progress-bar">

                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(
                            Number(
                              result.ats_score ||
                                0
                            ),
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <p className="match-text">
                      Project-level
                      ATS-style score based
                      on skill match,
                      resume sections and
                      text completeness.
                    </p>

                  </div>

                </div>

                {/* SKILL SUMMARY */}

                <div className="skills-summary">

                  <div className="skill-count matched-count">

                    <span className="count-number">
                      {
                        result
                          .matched_skills
                          ?.length || 0
                      }
                    </span>

                    <span className="count-label">
                      Matched Skills
                    </span>

                  </div>

                  <div className="skill-count missing-count">

                    <span className="count-number">
                      {
                        result
                          .missing_skills
                          ?.length || 0
                      }
                    </span>

                    <span className="count-label">
                      Missing Skills
                    </span>

                  </div>

                </div>

                {/* MATCHED SKILLS */}

                <div className="result-card">

                  <div className="section-title">

                    <div>

                      <h3>
                        ✓ Matched Skills
                      </h3>

                      <p>
                        Skills detected in
                        both your resume and
                        the job description.
                      </p>

                    </div>

                    <span className="skill-total matched-total">
                      {
                        result
                          .matched_skills
                          ?.length || 0
                      }
                    </span>

                  </div>

                  <div className="skills">

                    {result
                      .matched_skills
                      ?.length > 0 ? (

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
                        No matched skills
                        found.
                      </p>

                    )}

                  </div>

                </div>

                {/* MISSING SKILLS */}

                <div className="result-card">

                  <div className="section-title">

                    <div>

                      <h3>
                        ⚠ Missing Skills
                      </h3>

                      <p>
                        Skills required by
                        the job but not
                        detected in your
                        resume.
                      </p>

                    </div>

                    <span className="skill-total missing-total">
                      {
                        result
                          .missing_skills
                          ?.length || 0
                      }
                    </span>

                  </div>

                  <div className="skills">

                    {result
                      .missing_skills
                      ?.length > 0 ? (

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
                        No major missing
                        skills found.
                      </p>

                    )}

                  </div>

                </div>

                {/* SKILL GAP VISUALIZATION */}

                <div className="result-card">

                  <h3>
                    📊 Skill Gap
                    Visualization
                  </h3>

                  <p>
                    Skills required by
                    the job that are
                    currently missing
                    from the resume.
                  </p>

                  {result
                    .missing_skills
                    ?.length > 0 ? (

                    <div
                      style={{
                        marginTop:
                          "20px",
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
                                display:
                                  "flex",
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
                                width:
                                  "100%",
                                height:
                                  "10px",
                                background:
                                  "#e5e7eb",
                                borderRadius:
                                  "10px",
                                overflow:
                                  "hidden",
                              }}
                            >

                              <div
                                style={{
                                  width: `${getGapPercentage()}%`,
                                  height:
                                    "100%",
                                  background:
                                    "#ef4444",
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
                      No skill gaps
                      detected.
                    </p>

                  )}

                </div>

                {/* EXPLAINABLE MATCHING */}

                {result.related_matches &&
                  result.related_matches
                    .length > 0 && (

                    <div className="result-card">

                      <h3>
                        🔎 Explainable
                        Skill Matching
                      </h3>

                      <p>
                        Related skills
                        detected by the
                        analyzer.
                      </p>

                      <div
                        style={{
                          marginTop:
                            "15px",
                        }}
                      >

                        {result.related_matches.map(
                          (item, index) => {

                            let skillName =
                              "";

                            let matchedWith =
                              "";

                            if (
                              typeof item ===
                              "string"
                            ) {

                              skillName =
                                item;

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
                                  padding:
                                    "12px",
                                  marginBottom:
                                    "10px",
                                  borderRadius:
                                    "8px",
                                  background:
                                    "#f8fafc",
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
                                      {
                                        matchedWith
                                      }
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

                {/* JOB DESCRIPTION */}

                {result.job_description && (

                  <div className="result-card">

                    <h3>
                      📄 Job Description
                    </h3>

                    <div
                      style={{
                        maxHeight:
                          "250px",
                        overflowY:
                          "auto",
                        padding:
                          "15px",
                        marginTop:
                          "10px",
                        background:
                          "#f8fafc",
                        borderRadius:
                          "8px",
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {
                        result.job_description
                      }
                    </div>

                  </div>

                )}

                {/* AI CAREER ANALYSIS */}

                <div className="result-card">

                  <h3>
                    🤖 AI Career
                    Analysis
                  </h3>

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

        {/* ================================================= */}
        {/* DASHBOARD */}
        {/* ================================================= */}

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
                onClick={
                  loadHistory
                }
              >
                ↻ Refresh
              </button>

            </div>

            {/* Statistics */}

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

            {/* Common Missing Skills */}

            <div className="dashboard-card">

              <div className="dashboard-card-header">

                <div>

                  <h3>
                    Common Missing
                    Skills
                  </h3>

                  <p>
                    Skills frequently
                    missing across
                    analyzed jobs.
                  </p>

                </div>

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
                    No missing-skill
                    data available
                    yet.
                  </p>

                  <p>
                    Analyze a few
                    resumes to see
                    common skill gaps
                    here.
                  </p>

                </div>

              )}

            </div>

          </section>
        )}

        {/* ================================================= */}
        {/* HISTORY */}
        {/* ================================================= */}

        {activeTab === "history" && (

          <section className="history-section">

            <div className="dashboard-header">

              <div>

                <h2>
                  Analysis History
                </h2>

                <p>
                  View and manage your
                  previous analyses.
                </p>

              </div>

              <button
                className="refresh-button"
                onClick={
                  loadHistory
                }
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

            ) : history.length ===
              0 ? (

              <div className="empty-state">

                <h3>
                  No analyses yet
                </h3>

                <p>
                  Go to Resume Analyzer
                  and analyze your first
                  resume.
                </p>

              </div>

            ) : (

              <div className="history-list">

                {history.map(
                  (item) => {

                    const matchedSkills =
                      item.matched_skills
                        ? item.matched_skills
                            .split(",")
                            .map(
                              (skill) =>
                                skill.trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [];

                    const missingSkills =
                      item.missing_skills
                        ? item.missing_skills
                            .split(",")
                            .map(
                              (skill) =>
                                skill.trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [];

                    return (

                      <div
                        className="history-card"
                        key={item.id}
                      >

                        <div className="history-top">

                          <div>

                            <span className="analysis-number">
                              Analysis #
                              {item.id}
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
                            {
                              item.match_percentage
                            }%
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
                              marginTop:
                                "15px",
                              padding:
                                "12px",
                              background:
                                "#f8fafc",
                              borderRadius:
                                "8px",
                            }}
                          >

                            <strong>
                              Job
                              Description:
                            </strong>

                            <p
                              style={{
                                marginBottom:
                                  0,
                              }}
                            >
                              {item
                                .job_description
                                .length >
                              250
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
                  }
                )}

              </div>

            )}

          </section>
        )}

      </main>

    </div>
  );
}

export default App;