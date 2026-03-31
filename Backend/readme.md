# Career Analyzer AI Backend

## Architecture

```
Input: LinkedIn URL / Resume / Both
          │
          ▼
┌──────────────────────┐
│  linkedin_fetch_node  │  ← Apify Actor (primary, cached by profile)
└───────────┬──────────┘
            │
       success? ──YES───────────────────────────┐
            │                                   │
           NO                                   │
            ▼                                   │
┌──────────────────────┐                        │
│   web_search_node    │  ← Anthropic web search│
│   (fallback)         │    tool                │
└───────────┬──────────┘                        │
            │                                   │
            └──────────────┬────────────────────┘
                           ▼
               ┌──────────────────────┐
               │   extract_profile    │  ← Raw → structured JSON
               └──────────┬───────────┘
                           │
               ┌──────────────────────┐
               │   merge_profiles     │  ← LinkedIn + Resume merged
               └──────────┬───────────┘
                           │
               ┌──────────────────────┐
               │   analyze_profile    │  ← Score + Insights + Recs
               └──────────┬───────────┘
                           ▼
                   career_analysis.json
```

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env        # fill in your keys
python ai_backend.py resume.pdf
python ai_backend.py https://linkedin.com/in/username
python ai_backend.py resume.pdf https://linkedin.com/in/username
```

## API Keys

| Key | Required | Purpose | Cost |
|-----|----------|---------|------|
| `OPENAI_API_KEY` | If AI_CLIENT=openai | LLM analysis | Pay per token |
| `GROQ_API_KEY` | If AI_CLIENT=groq | LLM (fast/cheap) | Free tier |
| `AZURE_OPENAI_*` | If AI_CLIENT=azure | LLM analysis | Pay per token |
| `APIFY_API_TOKEN` | Recommended | LinkedIn primary fetch via actor | Per Apify plan |
| `ANTHROPIC_API_KEY` | Recommended | Web search fallback | Pay per token |

## Output Schema

```json
{
  "profile_score": 7.5,
  "score_breakdown": {
    "experience_depth": 8,
    "skill_relevance": 7,
    "education": 7,
    "profile_completeness": 8,
    "career_progression": 7
  },
  "ai_risk_assessment": {
    "overall_risk": "Medium",
    "risk_score": 55,
    "high_risk_skills": [],
    "low_risk_skills": [],
    "recommendation": "..."
  },
  "insights": {
    "strengths": [],
    "gaps": [],
    "market_position": "..."
  },
  "recommendations": [
    {"priority": "High", "action": "...", "reason": "..."}
  ]
}
```

## LangGraph Flow

```text
run_pipeline()
  -> build_analysis_graph()
  -> invoke graph with initial state
      |
      v
[validate_input_node]
  - checks linkedin_url / resume_text
  - sets data_source
  - if invalid -> [error_node] -> END
  - else -> [fetch_sources_node]

[fetch_sources_node]
  - if linkedin_url exists:
      try Apify fetch (reuse cached dataset_id if available)
      if success: linkedin_raw set
      if fail: fetch_failed = true
  - route:
      if fetch_failed -> [web_search_node]
      else -> [extract_profiles_node]

[web_search_node]
  - runs provider web search tool
  - if usable content: linkedin_raw set
  - then -> [extract_profiles_node]

[extract_profiles_node]
  - if linkedin_raw: extract LinkedIn structured profile (LLM call)
  - if resume_text: extract resume structured profile (LLM call)
  - -> [merge_profiles_node]

[merge_profiles_node]
  - merges linkedin_profile + resume_profile (LLM call when both present)
  - if empty merged_profile -> [error_node] -> END
  - else -> [analyze_node_graph]

[analyze_node_graph]
  - final analysis (LLM call)
  - adds risk, recommendations, jobs, upskilling, timeline
  - -> END

After END in run_pipeline():
  - if state.error: raise RuntimeError
  - else return state.result
```


python -m uvicorn exec_dashboard:app --host 127.0.0.1 --port 8001 --reload