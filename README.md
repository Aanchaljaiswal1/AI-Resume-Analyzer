# 🤖 AI Resume Analyzer

An AI-powered Resume Analyzer that evaluates a resume against a Job Description, identifies skill gaps, calculates an ATS-style score, and provides personalized career recommendations using Gemini AI.

## ✨ Features

- 📄 Upload and extract text from PDF resumes
- 📝 Analyze resume against a Job Description
- 🎯 Calculate resume-JD match percentage
- 📊 ATS-style resume score
- ✅ Identify matched skills
- ❌ Identify missing skills
- 🔗 Show related/transferable skill matches
- 🤖 AI-powered career analysis using Gemini
- 💡 Resume improvement suggestions
- 🗺️ Personalized learning roadmap
- 📚 Project recommendations based on skill gaps
- 🗄️ Store analysis history using MySQL
- 📥 Download analysis results as PDF
- 📈 Dashboard for previous resume analyses

## 🛠️ Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- jsPDF
- React Markdown

### Backend
- Python
- FastAPI
- SQLAlchemy
- PyMuPDF
- Pydantic

### Database
- MySQL

### AI
- Google Gemini API

### Development Tools
- Git
- GitHub
- VS Code

## 🔄 How It Works

```text
Resume PDF
    ↓
PDF Text Extraction
    ↓
Resume Skill Extraction
    ↓
Job Description Skill Extraction
    ↓
Skill Matching
    ↓
ATS-style Score
    ↓
Missing Skill Detection
    ↓
Gemini AI Analysis
    ↓
Career Recommendations
    ↓
Results Dashboard