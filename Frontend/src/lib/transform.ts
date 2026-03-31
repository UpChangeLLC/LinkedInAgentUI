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
    const out: MockResults = {
        score: Math.round(asNumber(r.profile_score, derivedProfileScore)),
        riskBand: readinessBand,
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
            industryAvg: asString(x?.industry_avg, ''),
            userValue: asString(x?.user_value, ''),
            insight: asString(x?.insight, '')
        })),
        // Score factors from either score_breakdown_list (preferred) or dimension_scores (fallback object)
        scoreFactors: (() => {
            const byList = (Array.isArray(r.score_breakdown_list) ? r.score_breakdown_list : []).map((x: any) => ({
                name: asString(x?.name, ''),
                weight: asString(x?.weight || x?.importance || '', ''),
                value: asNumber(x?.score, 0),
                explanation: asString(x?.why || x?.explanation, ''),
                personalContext: asString(x?.context || '', '')
            }))
            if (byList.length) return byList
            const dims = r.dimension_scores && typeof r.dimension_scores === 'object' ? r.dimension_scores : {}
            return Object.keys(dims).map((k) => {
                const v = (dims as any)[k] || {}
                return {
                    name: asString(k, ''),
                    weight: '',
                    value: asNumber(v.score, 0),
                    explanation: asString(v.rationale, ''),
                    personalContext: ''
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
        }
    }

    // Backfill with fallback mock where required by UI
    const merged: MockResults = {
        ...fallbackMock,
        ...out,
        industryContext: { ...fallbackMock.industryContext, ...out.industryContext },
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

