export interface ScoreFactor {
  name: string;
  weight: string;
  value: number;
  explanation: string;
  personalContext: string;
}

export interface WorkflowItem {
  name: string;
  explanation: string;
  firstStep: string;
  estimatedSavings: string;
  currentPainPoint: string;
  automationPercentage: number;
}

export interface LeverageItem {
  title: string;
  whyItMatters: string;
  exampleUseCase: string;
  timeToImplement: string;
  estimatedROI: string;
  companySpecificContext: string;
}

export interface GovernanceItem {
  control: string;
  whyItMatters: string;
  policySuggestion: string;
  currentStatus: 'missing' | 'partial' | 'implemented';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  industryContext: string;
}

export interface PlanItem {
  week: string;
  focus: string;
  actionSteps: string[];
  expectedOutcome: string;
  ownerRole: string;
}

export interface PersonalProfile {
  name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  experience: string;
  connections: string;
  photoPlaceholder: string;
  companyStage: string;
  companySize: string;
  reportsTo: string;
  directReports: string;
}

export interface PersonalRisk {
  roleAutomationRisk: number;
  skillRelevanceScore: number;
  adaptabilityIndex: number;
  networkLeverage: number;
  leadershipAIReadiness: number;
  personalRiskBand: string;
  keyStrengths: {title: string;detail: string;}[];
  vulnerabilities: {
    title: string;
    detail: string;
    urgency: 'high' | 'medium' | 'low';
  }[];
  careerRecommendations: {
    title: string;
    detail: string;
    timeframe: string;
    impact: string;
  }[];
}

export interface CompetitorIntel {
  name: string;
  aiInitiative: string;
  impact: string;
}

export interface IndustryBenchmark {
  metric: string;
  industryAvg: number;
  userValue: number;
  insight: string;
}

export interface IndustryContext {
  name: string;
  aiAdoptionRate: number;
  avgScore: number;
  topThreat: string;
  topOpportunity: string;
  regulatoryNote: string;
}

export interface MockResults {
  score: number;
  riskBand: string;
  executiveBrief: string;
  personalNarrative: string;
  companyAnalysis: string;
  industryContext: IndustryContext;
  competitorIntel: CompetitorIntel[];
  industryBenchmarks: IndustryBenchmark[];
  scoreFactors: ScoreFactor[];
  workflowItems: WorkflowItem[];
  leverageItems: LeverageItem[];
  governanceItems: GovernanceItem[];
  planItems: PlanItem[];
  personalProfile: PersonalProfile;
  personalRisk: PersonalRisk;
}

export const mockResults: MockResults = {
  score: 63,
  riskBand: 'Moderate Risk',
  executiveBrief:
  "TechCorp is at a pivotal inflection point. While your engineering teams have begun ad-hoc AI adoption, the lack of a centralized governance framework exposes the company to significant IP risk. Your 'Moderate Risk' score reflects this tension: high strategic potential throttled by operational immaturity. Immediate action is required to standardize AI procurement and upskill your 450+ employees before competitors like Salesforce and HubSpot fully operationalize their AI moats.",
  personalNarrative:
  "Sarah, your 12 years of operational leadership provide a strong foundation, but your AI-specific technical fluency is lagging behind the curve for a Series C COO. You excel at strategic decision-making, yet your daily workflows remain manually intensive. To lead TechCorp through this transition, you must pivot from being an 'AI observer' to an 'AI architect'—delegating the technical implementation while owning the strategic roadmap.",
  companyAnalysis:
  "As a Series C Enterprise SaaS player, TechCorp's data moat is its most valuable asset. However, your current siloed data infrastructure prevents the deployment of high-leverage agentic workflows. Our analysis detects 14 distinct shadow AI tools currently in use across your marketing and engineering teams, creating a fragmented intelligence layer that dilutes your competitive advantage.",
  industryContext: {
    name: 'Enterprise SaaS',
    aiAdoptionRate: 67,
    avgScore: 54,
    topThreat: 'Commoditization of core features by LLM wrappers',
    topOpportunity:
    'Hyper-personalized customer onboarding via autonomous agents',
    regulatoryNote:
    'EU AI Act compliance will be mandatory for your sector by Q4.'
  },
  competitorIntel: [
  {
    name: 'Salesforce',
    aiInitiative: 'Einstein GPT integration across all clouds',
    impact: 'High threat to your CRM integration revenue'
  },
  {
    name: 'HubSpot',
    aiInitiative: 'ChatSpot.ai natural language interface',
    impact: 'Sets new UX standard for your SMB customers'
  },
  {
    name: 'Notion',
    aiInitiative: 'Notion AI writing assistant',
    impact: 'Erodes your documentation feature value prop'
  }],

  industryBenchmarks: [
  {
    metric: 'AI Budget %',
    industryAvg: 12,
    userValue: 4,
    insight: 'Significantly underinvesting vs peers'
  },
  {
    metric: 'Data Readiness',
    industryAvg: 72,
    userValue: 55,
    insight: 'Lagging due to siloed customer data'
  },
  {
    metric: 'Talent Density',
    industryAvg: 18,
    userValue: 22,
    insight: 'Strong engineering talent base to leverage'
  },
  {
    metric: 'Gov. Maturity',
    industryAvg: 60,
    userValue: 20,
    insight: 'Critical vulnerability in policy enforcement'
  }],

  scoreFactors: [
  {
    name: 'Automation Exposure',
    weight: 'High',
    value: 78,
    explanation: 'High potential for task automation in current role.',
    personalContext:
    'As COO, 78% of your reporting and resource allocation tasks can be automated. You are currently spending ~14 hours/week on work that AI agents could handle.'
  },
  {
    name: 'Decision Complexity',
    weight: 'Med',
    value: 45,
    explanation: 'Strategic decisions still require human judgment.',
    personalContext:
    'Your strategic pivots regarding the Series C expansion require high-level judgment, insulating you from total replacement but demanding better data support.'
  },
  {
    name: 'Strategic Leverage',
    weight: 'High',
    value: 62,
    explanation: 'Significant opportunity to amplify output with AI.',
    personalContext:
    "TechCorp's proprietary customer usage data is a goldmine for training a fine-tuned model, offering a 10x leverage opportunity if unlocked."
  },
  {
    name: 'Data Dependency',
    weight: 'Med',
    value: 55,
    explanation: 'Workflows are moderately dependent on structured data.',
    personalContext:
    "Your reliance on fragmented spreadsheets for budget forecasting limits AI's ability to provide real-time predictive insights."
  },
  {
    name: 'Team Readiness',
    weight: 'Low',
    value: 30,
    explanation: 'Current team structure requires upskilling.',
    personalContext:
    'Your direct reports (VP Sales, VP Eng) have divergent AI views. Engineering is ahead; Sales is dangerously behind, creating an operational gap.'
  },
  {
    name: 'Governance Maturity',
    weight: 'High',
    value: 40,
    explanation: 'Policies lagging behind adoption curve.',
    personalContext:
    'TechCorp has no formal policy on LLM usage with customer data, a critical risk given your Enterprise client base.'
  }],

  workflowItems: [
  {
    name: 'Strategic Reporting',
    explanation: 'Automated data synthesis can reduce reporting time by 60%.',
    firstStep: 'Connect BI tools to LLM interface.',
    estimatedSavings: '$45k/yr',
    currentPainPoint: 'Manual synthesis of 12+ weekly department reports',
    automationPercentage: 78
  },
  {
    name: 'Market Analysis',
    explanation: 'Real-time competitor tracking is now possible at scale.',
    firstStep: 'Deploy agent-based web monitoring.',
    estimatedSavings: '$28k/yr',
    currentPainPoint: 'Reactive tracking of competitor feature launches',
    automationPercentage: 65
  },
  {
    name: 'Internal Comms',
    explanation: 'Drafting and personalizing executive comms.',
    firstStep: 'Train style-aligned model on past emails.',
    estimatedSavings: '$12k/yr',
    currentPainPoint: '3+ hours/week drafting all-hands updates',
    automationPercentage: 42
  },
  {
    name: 'Budget Forecasting',
    explanation: 'Predictive modeling using historical burn rates.',
    firstStep: 'Clean historical finance data for ingestion.',
    estimatedSavings: '$35k/yr',
    currentPainPoint: 'Quarterly variance analysis takes 2 weeks',
    automationPercentage: 71
  },
  {
    name: 'Vendor Management',
    explanation: 'Automated renewal tracking and sentiment analysis.',
    firstStep: 'Centralize contract data.',
    estimatedSavings: '$18k/yr',
    currentPainPoint: 'Missed renewal windows and leverage loss',
    automationPercentage: 55
  }],

  leverageItems: [
  {
    title: 'Predictive Resource Allocation',
    whyItMatters: 'Reduces waste and optimizes capital deployment.',
    exampleUseCase: 'Forecasting project budget overruns before they happen.',
    timeToImplement: '30 Days',
    estimatedROI: '4.5x',
    companySpecificContext:
    'For TechCorp, applying this to your engineering headcount planning could save ~$1.2M in misallocated resources annually.'
  },
  {
    title: 'Automated Compliance Checks',
    whyItMatters: 'Mitigates risk without slowing velocity.',
    exampleUseCase: 'Real-time contract review against policy.',
    timeToImplement: '14 Days',
    estimatedROI: '2.8x',
    companySpecificContext:
    'Given your SOC2 requirements, automating this reduces audit prep time by ~40% for your GRC team.'
  },
  {
    title: 'Customer Sentiment Engine',
    whyItMatters: 'Direct line to market truth.',
    exampleUseCase: 'Aggregating support tickets into strategic themes.',
    timeToImplement: '45 Days',
    estimatedROI: '6.2x',
    companySpecificContext:
    'Unlocking insights from your 5,000+ monthly support tickets will directly inform the Q3 product roadmap.'
  }],

  governanceItems: [
  {
    control: 'Data Privacy Shield',
    whyItMatters: 'Prevents IP leakage to public models.',
    policySuggestion: 'Mandatory enterprise instances for all AI tools.',
    currentStatus: 'missing',
    riskLevel: 'critical',
    industryContext: 'Standard for Series C SaaS companies handling PII.'
  },
  {
    control: 'Human-in-the-Loop',
    whyItMatters: 'Ensures accountability for AI decisions.',
    policySuggestion: 'All AI outputs require signed executive review.',
    currentStatus: 'partial',
    riskLevel: 'medium',
    industryContext: 'Required for automated customer communications.'
  },
  {
    control: 'Vendor Risk Assessment',
    whyItMatters: 'Third-party tools introduce new vectors.',
    policySuggestion:
    'Standardized AI security questionnaire for procurement.',
    currentStatus: 'missing',
    riskLevel: 'high',
    industryContext: 'Critical due to your reliance on 3rd party APIs.'
  },
  {
    control: 'Bias Monitoring',
    whyItMatters: 'Protects brand reputation and fairness.',
    policySuggestion: 'Quarterly audit of automated decision outputs.',
    currentStatus: 'missing',
    riskLevel: 'high',
    industryContext: 'Emerging requirement for EU clients.'
  }],

  planItems: [
  {
    week: 'Week 1',
    focus: 'Audit & Discovery',
    actionSteps: [
    'Map current high-volume workflows in Operations.',
    'Identify data silos preventing AI adoption in Finance.',
    'Conduct initial skills assessment for VP-level reports.'],

    expectedOutcome: "Full visibility into TechCorp's AI shadow IT usage.",
    ownerRole: 'You + VP Ops'
  },
  {
    week: 'Week 2',
    focus: 'Governance Framework',
    actionSteps: [
    'Draft acceptable use policy for Engineering vs Sales.',
    'Select enterprise-grade AI tooling (likely ChatGPT Enterprise).',
    'Establish AI steering committee with Legal.'],

    expectedOutcome: 'Risk-mitigated sandbox environment for testing.',
    ownerRole: 'You + General Counsel'
  },
  {
    week: 'Week 3',
    focus: 'Pilot Deployment',
    actionSteps: [
    'Launch "Internal Comms" pilot for your weekly updates.',
    'Train core Ops team on prompt engineering.',
    'Set up success metrics dashboard for the Board.'],

    expectedOutcome: 'First automated workflow live with 20% time savings.',
    ownerRole: 'You + Chief of Staff'
  },
  {
    week: 'Week 4',
    focus: 'Review & Scale',
    actionSteps: [
    'Analyze pilot results against KPIs.',
    'Refine governance based on usage data.',
    'Plan broader rollout to Customer Success team.'],

    expectedOutcome: 'Board-ready presentation on AI ROI.',
    ownerRole: 'You'
  }],

  personalProfile: {
    name: 'Sarah Chen',
    title: 'Chief Operating Officer',
    company: 'TechCorp',
    industry: 'Enterprise SaaS',
    location: 'San Francisco Bay Area',
    experience: '12 years',
    connections: '500+',
    photoPlaceholder: 'SC',
    companyStage: 'Series C',
    companySize: '450 Employees',
    reportsTo: 'CEO',
    directReports: '8 (VP Level)'
  },
  personalRisk: {
    roleAutomationRisk: 34,
    skillRelevanceScore: 78,
    adaptabilityIndex: 82,
    networkLeverage: 91,
    leadershipAIReadiness: 56,
    personalRiskBand: 'Well Positioned',
    keyStrengths: [
    {
      title: 'Strategic Vision',
      detail:
      'You see the long-term implications of AI beyond just cost savings.'
    },
    {
      title: 'Change Management',
      detail:
      'Your experience scaling TechCorp from Series A gives you credibility.'
    },
    {
      title: 'Cross-Functional Trust',
      detail: 'You have the political capital to unite Eng and Sales.'
    }],

    vulnerabilities: [
    {
      title: 'Technical Fluency',
      detail:
      'Lack of hands-on experience with LLM APIs limits your ability to vet vendors.',
      urgency: 'high'
    },
    {
      title: 'Data Infrastructure',
      detail:
      'Your reliance on manual reporting creates a bottleneck for real-time AI insights.',
      urgency: 'medium'
    },
    {
      title: 'Policy Vacuum',
      detail:
      'No formal AI guidelines puts TechCorp at legal risk immediately.',
      urgency: 'high'
    }],

    careerRecommendations: [
    {
      title: 'AI Leadership Certification',
      detail: 'Gain the technical vocabulary to challenge your CTO.',
      timeframe: '3 Months',
      impact: 'High'
    },
    {
      title: 'Build AI-First Culture',
      detail: 'Shift TechCorp from "AI-anxious" to "AI-native".',
      timeframe: '6 Months',
      impact: 'Critical'
    },
    {
      title: 'Personal AI Workflow',
      detail: 'Automate your own weekly reporting to lead by example.',
      timeframe: '1 Month',
      impact: 'Medium'
    }]

  }
};