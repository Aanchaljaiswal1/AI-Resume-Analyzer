import { useEffect, useState } from "react";
import "./App.css";

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
        "http://127.0.0.1:8000/history"
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

  // Load history when app starts
  useEffect(() => {
    loadHistory();
  }, []);

  // =========================
  // ANALYZE RESUME
  // =========================
  const handleAnalyze = async () => {
    if (!resumeFile) {
      setError("Please upload your resume PDF.");
      return;
    }

    if (!jobDescription.trim()) {
      setError("Please enter the job description.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // Upload Resume
      const formData = new FormData();
      formData.append("file", resumeFile);

      const resumeResponse = await fetch(
        "http://127.0.0.1:8000/upload-resume",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!resumeResponse.ok) {
        throw new Error("Resume upload failed.");
      }

      const resumeData = await resumeResponse.json();

      // Analyze Resume
      const analyzeResponse = await fetch(
        "http://127.0.0.1:8000/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resume_text: resumeData.text,
            job_description: jobDescription,
          }),
        }
      );

      if (!analyzeResponse.ok) {
        throw new Error("Resume analysis failed.");
      }

      const analysisData = await analyzeResponse.json();

      setResult(analysisData);

      // Refresh history after new analysis
      await loadHistory();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        `http://127.0.0.1:8000/history/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Could not delete analysis.");
      }

      await loadHistory();

      // Clear current result if deleted analysis is currently shown
      if (result && result.id === id) {
        setResult(null);
      }

    } catch (err) {
      setError(err.message);
    }
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

  // Find common missing skills
  const missingSkillCount = {};

  history.forEach((item) => {
    if (!item.missing_skills) {
      return;
    }

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

  // =========================
  // FORMAT AI TEXT
  // =========================

  const formatAIText = (text) => {
    if (!text) {
      return "No AI analysis available.";
    }

    return text;
  };

  return (
    <div className="app">

      {/* ================= HEADER ================= */}

      <header className="header">

        <div>
          <h1>AI Resume Analyzer</h1>

          <p>
            Analyze your resume against a job description
            using AI.
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
          onClick={() => setActiveTab("analyzer")}
        >
          Resume Analyzer
        </button>

        <button
          className={
            activeTab === "dashboard"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={
            activeTab === "history"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() => setActiveTab("history")}
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

            {/* Resume Upload */}

            <section className="card">

              <h2>1. Upload Resume</h2>

              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  setResumeFile(e.target.files[0]);
                  setError("");
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

              <h2>2. Job Description</h2>

              <textarea
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setError("");
                }}
                placeholder="Paste the job description here..."
                rows="10"
              />

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

            {/* ================= RESULTS ================= */}

            {result && (
              <section className="results">

                <h2>Analysis Result</h2>

                {/* Match Percentage */}

                <div className="match-card">

                  <h3>Resume Match</h3>

                  <div className="percentage">
                    {result.match_percentage}%
                  </div>

                  <div className="progress-bar">

                    <div
                      className="progress-fill"
                      style={{
                        width: `${result.match_percentage}%`,
                      }}
                    ></div>

                  </div>

                  <p className="match-text">
                    Your resume matches{" "}
                    {result.match_percentage}% of the
                    job requirements.
                  </p>

                </div>

                {/* Skills Summary */}

                <div className="skills-summary">

                  <div className="skill-count matched-count">

                    <span className="count-number">
                      {result.matched_skills.length}
                    </span>

                    <span className="count-label">
                      Matched Skills
                    </span>

                  </div>

                  <div className="skill-count missing-count">

                    <span className="count-number">
                      {result.missing_skills.length}
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
                        Skills found in both your
                        resume and the job description.
                      </p>

                    </div>

                    <span className="skill-total matched-total">
                      {result.matched_skills.length}
                    </span>

                  </div>

                  <div className="skills">

                    {result.matched_skills.length > 0 ? (

                      result.matched_skills.map((skill) => (

                        <span
                          className="skill matched"
                          key={skill}
                        >
                          ✓ {skill}
                        </span>

                      ))

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
                        but not detected in your resume.
                      </p>

                    </div>

                    <span className="skill-total missing-total">
                      {result.missing_skills.length}
                    </span>

                  </div>

                  <div className="skills">

                    {result.missing_skills.length > 0 ? (

                      result.missing_skills.map((skill) => (

                        <span
                          className="skill missing"
                          key={skill}
                        >
                          {skill}
                        </span>

                      ))

                    ) : (

                      <p>
                        No major missing skills found.
                      </p>

                    )}

                  </div>

                </div>

                {/* AI Analysis */}

                <div className="result-card">

                  <h3>
                    🤖 AI Career Analysis
                  </h3>

                  <div className="ai-analysis">
                    {formatAIText(result.ai_analysis)}
                  </div>

                </div>

              </section>
            )}

          </>
        )}

        {/* ================================================= */}
        {/* DASHBOARD TAB */}
        {/* ================================================= */}

        {activeTab === "dashboard" && (
          <section className="dashboard">

            <div className="dashboard-header">

              <div>
                <h2>Dashboard</h2>

                <p>
                  Overview of your resume analyses.
                </p>
              </div>

              <button
                className="refresh-button"
                onClick={loadHistory}
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
                  <p>Total Analyses</p>

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
                  <p>Average Match</p>

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
                  <p>Highest Match</p>

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
                    Common Missing Skills
                  </h3>

                  <p>
                    Skills that are frequently missing
                    across your analyzed jobs.
                  </p>

                </div>

              </div>

              {historyLoading ? (

                <p>
                  Loading dashboard...
                </p>

              ) : commonMissingSkills.length > 0 ? (

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
                    No missing-skill data available yet.
                  </p>

                  <p>
                    Analyze a few resumes to see
                    common skill gaps here.
                  </p>

                </div>

              )}

            </div>

          </section>
        )}

        {/* ================================================= */}
        {/* HISTORY TAB */}
        {/* ================================================= */}

        {activeTab === "history" && (
          <section className="history-section">

            <div className="dashboard-header">

              <div>

                <h2>
                  Analysis History
                </h2>

                <p>
                  View and manage your previous analyses.
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
                  Go to Resume Analyzer and analyze
                  your first resume.
                </p>

              </div>

            ) : (

              <div className="history-list">

                {history.map((item, index) => {

                  const matchedSkills =
                    item.matched_skills
                      ? item.matched_skills
                          .split(",")
                          .map((skill) => skill.trim())
                          .filter(Boolean)
                      : [];

                  const missingSkills =
                    item.missing_skills
                      ? item.missing_skills
                          .split(",")
                          .map((skill) => skill.trim())
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
                            Resume Analysis
                          </h3>

                        </div>

                        <div className="history-match">
                          {item.match_percentage}%
                        </div>

                      </div>

                      <div className="history-progress">

                        <div
                          style={{
                            width: `${item.match_percentage}%`,
                          }}
                        ></div>

                      </div>

                      <div className="history-skills">

                        <div>

                          <strong>
                            Matched:
                          </strong>

                          {matchedSkills.length > 0
                            ? matchedSkills.join(", ")
                            : " None"}

                        </div>

                        <div>

                          <strong>
                            Missing:
                          </strong>

                          {missingSkills.length > 0
                            ? missingSkills.join(", ")
                            : " None"}

                        </div>

                      </div>

                      <div className="history-actions">

                        <button
                          className="view-button"
                          onClick={() => {
                            setResult({
                              id: item.id,
                              match_percentage:
                                item.match_percentage,
                              matched_skills:
                                matchedSkills,
                              missing_skills:
                                missingSkills,
                              ai_analysis:
                                item.ai_analysis,
                            });

                            setActiveTab("analyzer");
                          }}
                        >
                          View Details
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            handleDelete(item.id)
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