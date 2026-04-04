import { MockResults } from '../data/mockResults'
import { mockResults as fallbackMock } from '../data/mockResults'

function asString(v: any, def = '') {
    return (typeof v === 'string' && v.trim().length > 0) ? v : def
}

function asNumber(v: any, def = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : def
}

/** Maps API severity strings to UI urgency keys (UrgencyBadge). */
function normalizeUrgency(raw: string): 'high' | 'medium' | 'low' {
    const s = (raw || '').trim().toLowerCase()
    if (s === 'high' || s === 'critical') return 'high'
    if (s === 'low') return 'low'
    return 'medium'
}

export function toMockResults(backend: any): MockResults {
    const r = backend || {}
    const overall = r.overall_assessment || {}
    const risk = r.ai_risk_assessment || {}
    const profileName = asString(r.name, 'Unknown')
    const title = asString(r.title, asString(r.benchmark_role, ''))
    const company = asString(r.company, '')
    const industry = asString(r.industry, '')
    const location = asString(r.location, '')
    const years = asNumber(r.years_experience, 0)
    const rolesHeld = asNumber(r.roles_held, 0)
    const dims = r.dimension_scores && typeof r.dimension_scores === 'object' ? r.dimension_scores : {}
    const getDimScore = (key: string) => {
        const v = (dims as any)[key]
        const s = asNumber(v?.score, NaN)
        return Number.isFinite(s) ? s : NaN
    }
    // Derive a composite 0-100 score from dimension_scores if profile_score is missing
    const dimList = [
        getDimScore('ai_fluency'),
        getDimScore('technical_proximity'),
        getDimScore('governance_awareness'),
        getDimScore('learning_velocity'),
        getDimScore('leadership_readiness'),
        getDimScore('network_relevance'),
        getDimScore('automation_exposure'),
        getDimScore('execution_credibility')
    ].filter((x) => Number.isFinite(x))
    const derivedProfileScore = dimList.length ? Math.round((dimList.reduce((a, b) => a + (b as number), 0) / dimList.length) * 20) : 0

    const readinessBand = asString(overall.ai_readiness, asString(risk.overall_risk, ''))

    // Build MockResults with safe fallbacks
    const out = {
        score: Math.round(asNumber(r.profile_score, derivedProfileScore)),
        riskBand: readinessBand,
        scoreNarrative: asString(r.score_narrative, ''),
        executiveBrief: asString(r.executive_summary, asString(r.summary, '')),
        // Backend v2 uses executive_summary; Personal Overview binds the letter to personalNarrative
        personalNarrative: asString(
            r.personal_narrative,
            asString(r.executive_summary, asString(r.summary, ''))
        ),
        companyAnalysis: asString(r.company_analysis, ''),
        industryContext: {
            name: industry || '—',
            aiAdoptionRate: asNumber(r.industry_ai_adoption_rate, 0),
            avgScore: asNumber(r.industry_avg_score, 0),
            topThreat: asString(r.top_industry_threat, ''),
            topOpportunity: asString(r.top_industry_opportunity, ''),
            regulatoryNote: asString(r.regulatory_note, '')
        },
        competitorIntel: (Array.isArray(r.competitor_intel) ? r.competitor_intel : []).map((x: any) => ({
            name: asString(x?.name, ''),
            aiInitiative: asString(x?.initiative || x?.ai_initiative, ''),
            impact: asString(x?.impact, '')
        })),
        industryBenchmarks: (Array.isArray(r.industry_benchmarks) ? r.industry_benchmarks : []).map((x: any) => ({
            metric: asString(x?.metric, ''),
            industryAvg: asNumber(x?.industry_avg, 0),
            userValue: asNumber(x?.user_value, 0),
            insight: asString(x?.insight, '')
        })),
        // Score factors from either score_breakdown_list (preferred) or dimension_scores (fallback object)
        scoreFactors: (() => {
            // Helper to extract evidence items from dimension data
            const mapEvidence = (evidenceArr: any[], source: string = 'linkedin') => {
                if (!Array.isArray(evidenceArr)) return []
                return evidenceArr
                    .filter((e: any) => typeof e === 'string' && e.trim())
                    .map((e: any) => ({ text: String(e), source: source as any }))
            }

            const byList = (Array.isArray(r.score_breakdown_list) ? r.score_breakdown_list : []).map((x: any) => ({
                name: asString(x?.name, ''),
                weight: asString(x?.weight || x?.importance || '', ''),
                value: asNumber(x?.value ?? x?.score, 0),
                explanation: asString(x?.why || x?.explanation, ''),
                personalContext: asString(x?.personal_context || x?.context || '', ''),
                confidence: (asString(x?.confidence, '') as any) || undefined,
                evidence: mapEvidence(x?.evidence, r.data_source?.includes('resume') ? 'resume' : 'linkedin'),
                narrative: asString(x?.narrative, '') || undefined,
            }))
            if (byList.length) return byList
            // Fallback: derive from dimension_scores (1-5 scale → 0-100)
            const dimWeightMap: Record<string, string> = {
                ai_fluency: 'High', technical_proximity: 'High',
                governance_awareness: 'Med', learning_velocity: 'Med',
                leadership_readiness: 'High', network_relevance: 'Low',
                automation_exposure: 'High', execution_credibility: 'Med'
            }
            const dimNameMap: Record<string, string> = {
                ai_fluency: 'AI Fluency', technical_proximity: 'Technical Proximity',
                governance_awareness: 'Governance Awareness', learning_velocity: 'Learning Velocity',
                leadership_readiness: 'Leadership Readiness', network_relevance: 'Network Relevance',
                automation_exposure: 'Automation Exposure', execution_credibility: 'Execution Credibility'
            }
            const dims = r.dimension_scores && typeof r.dimension_scores === 'object' ? r.dimension_scores : {}
            const dataSource = asString(r.data_source, 'linkedin')
            return Object.keys(dims).map((k) => {
                const v = (dims as any)[k] || {}
                const raw = asNumber(v.score, 0)
                return {
                    name: dimNameMap[k] || asString(k, ''),
                    weight: dimWeightMap[k] || 'Med',
                    value: Math.round(raw * 20),
                    explanation: asString(v.rationale, ''),
                    personalContext: asString(v.rationale, ''),
                    confidence: (asString(v.confidence, '') as any) || undefined,
                    evidence: mapEvidence(v.evidence, dataSource.includes('resume') ? 'resume' : 'linkedin'),
                    narrative: asString(v.narrative, '') || undefined,
                }
            })
        })(),
        workflowItems: (Array.isArray(r.workflow_items) ? r.workflow_items : []).map((x: any) => ({
            name: asString(x?.name, ''),
            explanation: asString(x?.explanation || x?.why, ''),
            firstStep: asString(x?.first_step, ''),
            estimatedSavings: asString(x?.estimated_savings, ''),
            currentPainPoint: asString(x?.current_pain_point, ''),
            automationPercentage: asNumber(x?.automation_percentage, 0)
        })),
        leverageItems: (Array.isArray(r.leverage_items) ? r.leverage_items : []).map((x: any) => ({
            title: asString(x?.title, ''),
            whyItMatters: asString(x?.why_it_matters, ''),
            exampleUseCase: asString(x?.example_use_case, ''),
            timeToImplement: asString(x?.time_to_implement, ''),
            estimatedROI: asString(x?.estimated_roi, ''),
            companySpecificContext: asString(x?.company_specific_context, '')
        })),
        governanceItems: (Array.isArray(r.governance_items) ? r.governance_items : []).map((x: any) => ({
            control: asString(x?.control, ''),
            whyItMatters: asString(x?.why_it_matters, ''),
            policySuggestion: asString(x?.policy_suggestion, ''),
            currentStatus: (asString(x?.current_status, 'missing') as any),
            riskLevel: (asString(x?.risk_level, 'medium') as any),
            industryContext: asString(x?.industry_context, '')
        })),
        planItems: (() => {
            const t = r.action_timeline_30_60_90 || {}
            const seq = [
                { week: 'Week 1', list: t.day_0_30 },
                { week: 'Week 2', list: t.day_31_60 },
                { week: 'Week 3', list: t.day_61_90 }
            ]
            return seq.map((s) => ({
                week: s.week,
                focus: '',
                actionSteps: Array.isArray(s.list) ? s.list : [],
                expectedOutcome: '',
                ownerRole: ''
            }))
        })(),
        personalProfile: {
            name: profileName,
            title,
            company,
            industry,
            location,
            experience: years ? String(years) : '',
            connections: '',
            photoPlaceholder: profileName ? (profileName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()) : '',
            companyStage: '',
            companySize: '',
            reportsTo: '',
            directReports: rolesHeld ? String(rolesHeld) : ''
        },
        personalRisk: {
            roleAutomationRisk: (() => {
                const v = asNumber(r.role_automation_risk, NaN)
                if (Number.isFinite(v)) return v
                const s = getDimScore('automation_exposure')
                return Number.isFinite(s) ? Math.round((s as number) * 20) : 0
            })(),
            skillRelevanceScore: (() => {
                const v = asNumber(r.skill_relevance_score, NaN)
                if (Number.isFinite(v)) return v
                const s = getDimScore('technical_proximity')
                return Number.isFinite(s) ? Math.round((s as number) * 20) : 0
            })(),
            adaptabilityIndex: (() => {
                const v = asNumber(r.adaptability_index, NaN)
                if (Number.isFinite(v)) return v
                const s = getDimScore('learning_velocity')
                return Number.isFinite(s) ? Math.round((s as number) * 20) : 0
            })(),
            networkLeverage: (() => {
                const v = asNumber(r.network_leverage, NaN)
                if (Number.isFinite(v)) return v
                const s = getDimScore('network_relevance')
                return Number.isFinite(s) ? Math.round((s as number) * 20) : 0
            })(),
            leadershipAIReadiness: (() => {
                const v = asNumber(r.leadership_ai_readiness, NaN)
                if (Number.isFinite(v)) return v
                const s = getDimScore('leadership_readiness')
                return Number.isFinite(s) ? Math.round((s as number) * 20) : 0
            })(),
            personalRiskBand: asString(r.personal_risk_band, readinessBand),
            keyStrengths: (() => {
                const primary = (Array.isArray(r.strengths) ? r.strengths : (Array.isArray(r.insights?.strengths) ? r.insights.strengths : [])).map((x: any) => ({
                    title: asString(x?.title || x, ''),
                    detail: asString(x?.why_it_matters || x?.detail || '', '')
                }))
                if (primary.length) return primary
                const alt = Array.isArray(r.top_strengths) ? r.top_strengths : []
                return alt.map((x: any) => ({
                    title: asString(x?.title || '', ''),
                    detail: asString(x?.why_it_matters || x?.evidence || '', '')
                }))
            })(),
            vulnerabilities: (() => {
                const primary = (Array.isArray(r.gaps) ? r.gaps : (Array.isArray(r.insights?.gaps) ? r.insights.gaps : [])).map((x: any) => ({
                    title: asString(x?.title || x, ''),
                    detail: asString(x?.why_it_matters || x?.detail || '', ''),
                    urgency: normalizeUrgency(asString(x?.severity, 'medium'))
                }))
                if (primary.length) return primary
                const alt = Array.isArray(r.top_gaps_risks) ? r.top_gaps_risks : []
                return alt.map((x: any) => ({
                    title: asString(x?.title || '', ''),
                    detail: asString(x?.why_it_matters || x?.evidence || '', ''),
                    urgency: normalizeUrgency(asString(x?.severity, 'medium'))
                }))
            })(),
            careerRecommendations: (() => {
                const recs = Array.isArray(r.recommendations) ? r.recommendations : []
                const base = recs.length
                    ? recs.map((x: any) => ({
                        title: asString(x?.priority || x?.title, ''),
                        detail: asString(x?.reason || x?.detail, ''),
                        timeframe: asString(x?.timeframe, ''),
                        impact: asString(x?.impact, '')
                    }))
                    : (Array.isArray(r.recommended_next_moves_90_days) ? r.recommended_next_moves_90_days : []).map((x: any) => ({
                        title: asString(x?.action || x?.priority || '', ''),
                        detail: asString(x?.reason || '', ''),
                        timeframe: '0-90 days',
                        impact: ''
                    }))
                // Quick hack: append job_recommendations as career-style items
                const jobs = Array.isArray(r.job_recommendations) ? r.job_recommendations : []
                const jobMapped = jobs.map((j: any) => ({
                    title: asString(j?.role || '', ''),
                    detail: asString(j?.reason || '', ''),
                    timeframe: '',
                    impact: (Number.isFinite(Number(j?.fit_score)) ? `${Number(j.fit_score)}% fit` : asString(j?.fit_score, ''))
                }))
                return [...base, ...jobMapped]
            })()
        },
        // Initialize Sprint 4-7 fields (populated below)
        skillGapMatrix: [],
        disruptionTimeline: [],
        careerPathways: [],
        scoreDelta: null,
        actionItems: [],
        urlHash: '',
    } as MockResults

    // Sprint 6: Career Pathways
    out.careerPathways = (Array.isArray(r.career_pathways) ? r.career_pathways : []).map((x: any) => ({
        name: asString(x?.name, ''),
        description: asString(x?.description, ''),
        requiredSkills: Array.isArray(x?.required_skills) ? x.required_skills.filter((s: any) => typeof s === 'string' && s.trim()) : [],
        timelineMonths: asNumber(x?.timeline_months, 0),
        difficulty: (['easy', 'moderate', 'challenging'].includes(asString(x?.difficulty, ''))
            ? asString(x?.difficulty, 'moderate') : 'moderate') as any,
        salaryImpact: asString(x?.salary_impact, ''),
        recommended: Boolean(x?.recommended),
    }))

    // F22: Score delta from previous assessment
    const rawDelta = r.score_delta
    if (rawDelta && typeof rawDelta === 'object') {
        out.scoreDelta = {
            previousScore: asNumber(rawDelta.previous_score, 0),
            scoreDelta: asNumber(rawDelta.score_delta, 0),
            previousRiskBand: asString(rawDelta.previous_risk_band, ''),
            daysSinceLast: asNumber(rawDelta.days_since_last, 0),
            dimensionDeltas: (rawDelta.dimension_deltas && typeof rawDelta.dimension_deltas === 'object')
                ? rawDelta.dimension_deltas : {},
            previousAssessmentDate: asString(rawDelta.previous_assessment_date, '') || null,
        }
    }

    // F24: Action items
    out.actionItems = (Array.isArray(r.action_items) ? r.action_items : []).map((x: any, idx: number) => ({
        id: asString(x?.id, `action-${idx}`),
        title: asString(x?.title, ''),
        description: asString(x?.description, ''),
        category: (['learning', 'networking', 'projects', 'governance'].includes(asString(x?.category, ''))
            ? asString(x?.category, 'learning') : 'learning') as any,
        priority: (['high', 'medium', 'low'].includes(asString(x?.priority, ''))
            ? asString(x?.priority, 'medium') : 'medium') as any,
        estimatedHours: asNumber(x?.estimated_hours, 0),
        resourceUrl: asString(x?.resource_url, ''),
        resourceTitle: asString(x?.resource_title, ''),
        status: 'pending' as const,
        completedAt: null,
    })).filter((a: any) => a.title.trim().length > 0)

    // Backfill with defaults for new Sprint 4 features
    out.skillGapMatrix = (Array.isArray(r.skill_gap_matrix) ? r.skill_gap_matrix : []).map((x: any) => ({
        name: asString(x?.name, ''),
        proficiency: Math.max(1, Math.min(5, asNumber(x?.proficiency, 1))),
        marketDemand: Math.max(1, Math.min(5, asNumber(x?.market_demand, 1))),
        category: (['ai-core', 'ai-adjacent', 'foundational'].includes(asString(x?.category, ''))
            ? asString(x?.category, 'foundational') : 'foundational') as any,
        justification: asString(x?.justification, ''),
        learningResource: asString(x?.learning_resource, ''),
    }))
    out.disruptionTimeline = (Array.isArray(r.disruption_timeline) ? r.disruption_timeline : []).map((x: any) => ({
        task: asString(x?.task, ''),
        year: asNumber(x?.year, 2026),
        automationProbability: Math.max(0, Math.min(100, asNumber(x?.automation_probability, 0))),
        impact: (['high', 'medium', 'low'].includes(asString(x?.impact, ''))
            ? asString(x?.impact, 'medium') : 'medium') as any,
        mitigation: asString(x?.mitigation, ''),
    })).sort((a: any, b: any) => a.year - b.year)

    // Compute URL hash for action tracker API calls
    out.urlHash = asString(r._url_hash, '')

    // Backfill with fallback mock where required by UI
    const merged: MockResults = {
        ...fallbackMock,
        ...out,
        industryContext: {
            name: out.industryContext.name && out.industryContext.name !== '—'
                ? out.industryContext.name : fallbackMock.industryContext.name,
            aiAdoptionRate: out.industryContext.aiAdoptionRate > 0
                ? out.industryContext.aiAdoptionRate : fallbackMock.industryContext.aiAdoptionRate,
            avgScore: out.industryContext.avgScore > 0
                ? out.industryContext.avgScore : fallbackMock.industryContext.avgScore,
            topThreat: out.industryContext.topThreat || fallbackMock.industryContext.topThreat,
            topOpportunity: out.industryContext.topOpportunity || fallbackMock.industryContext.topOpportunity,
            regulatoryNote: out.industryContext.regulatoryNote || fallbackMock.industryContext.regulatoryNote,
        },
        competitorIntel: out.competitorIntel?.length ? out.competitorIntel : fallbackMock.competitorIntel,
        industryBenchmarks: out.industryBenchmarks?.length ? out.industryBenchmarks : fallbackMock.industryBenchmarks,
        scoreFactors: out.scoreFactors?.length ? out.scoreFactors : fallbackMock.scoreFactors,
        workflowItems: out.workflowItems?.length ? out.workflowItems : fallbackMock.workflowItems,
        leverageItems: out.leverageItems?.length ? out.leverageItems : fallbackMock.leverageItems,
        governanceItems: out.governanceItems?.length ? out.governanceItems : fallbackMock.governanceItems,
        planItems: out.planItems?.length ? out.planItems : fallbackMock.planItems,
        personalProfile: { ...fallbackMock.personalProfile, ...out.personalProfile },
        personalRisk: {
            ...fallbackMock.personalRisk,
            ...out.personalRisk,
            keyStrengths: out.personalRisk.keyStrengths?.length ? out.personalRisk.keyStrengths : fallbackMock.personalRisk.keyStrengths,
            vulnerabilities: out.personalRisk.vulnerabilities?.length ? out.personalRisk.vulnerabilities : fallbackMock.personalRisk.vulnerabilities,
            careerRecommendations: out.personalRisk.careerRecommendations?.length ? out.personalRisk.careerRecommendations : fallbackMock.personalRisk.careerRecommendations
        }
    }
    return merged
}

