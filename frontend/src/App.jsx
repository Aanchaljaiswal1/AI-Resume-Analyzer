import { useState } from "react";
import "./App.css";

function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>AI Resume Analyzer</h1>
        <p>
          Analyze your resume against a job description using AI.
        </p>
      </header>

      <main className="container">

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

        <button
          className="analyze-button"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze Resume"}
        </button>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {result && (
          <section className="results">

            <h2>Analysis Result</h2>

            <div className="match-card">
              <h3>Resume Match</h3>

              <div className="percentage">
                {result.match_percentage}%
              </div>
            </div>

            <div className="result-card">
              <h3>Matched Skills</h3>

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
                  <p>No matched skills found.</p>
                )}
              </div>
            </div>

            <div className="result-card">
              <h3>Missing Skills</h3>

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
                  <p>No major missing skills found.</p>
                )}
              </div>
            </div>

            <div className="result-card">
              <h3>AI Career Analysis</h3>

              <div className="ai-analysis">
                {result.ai_analysis}
              </div>
            </div>

          </section>
        )}

      </main>
    </div>
  );
}

export default App;