import React from 'react';
import { motion } from 'framer-motion';
import { ScoreGauge } from '../ui/ScoreGauge';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MockResults } from '../../data/mockResults';
import {
  User,
  MapPin,
  Briefcase,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  Calendar } from
'lucide-react';
import { DeltaBadge } from '../ui/DeltaBadge';
interface PersonalOverviewSectionProps {
  results: MockResults;
}
export function PersonalOverviewSection({
  results
}: PersonalOverviewSectionProps) {
  const { personalProfile, personalRisk, personalNarrative, industryContext, scoreDelta } =
  results;
  return (
    <div className="space-y-8">
      {/* Personal Narrative Letter */}
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="bg-dark-card rounded-xl border border-dark-border p-8 border-l-4 border-l-dark-accent">

        <h3 className="text-xl font-bold text-dark-textPri mb-4">
          Executive Assessment for {personalProfile.name}
        </h3>
        <p className="text-dark-textSec text-lg leading-relaxed whitespace-pre-line">
          {personalNarrative}
        </p>
      </motion.div>

      {/* Profile Header Card */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-6 flex flex-col md:flex-row gap-6 items-start">
        <div className="w-24 h-24 rounded-full bg-dark-elevated flex items-center justify-center text-2xl font-bold text-dark-textMuted flex-shrink-0 border-4 border-dark-elevated">
          {personalProfile.photoPlaceholder}
        </div>
        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-bold text-dark-textPri">
                {personalProfile.name}
              </h2>
              <p className="text-lg text-dark-textSec">
                {personalProfile.title} at {personalProfile.company}
              </p>
            </div>
            <Badge
              variant="success"
              className="text-base px-3 py-1 self-start md:self-center">

              {personalRisk.personalRiskBand}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <DetailPill icon={Building2} label={personalProfile.companyStage} />
            <DetailPill icon={Users} label={personalProfile.companySize} />
            <DetailPill
              icon={Briefcase}
              label={`Reports to ${personalProfile.reportsTo}`} />

            <DetailPill
              icon={Users}
              label={`${personalProfile.directReports} Direct Reports`} />

          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Personal Score */}
        <Card className="p-6 flex flex-col items-center justify-center col-span-1 border-t-4 border-t-dark-accent">
          <h3 className="text-lg font-bold text-dark-textPri mb-4">
            AI Readiness Score
          </h3>
          <ScoreGauge
            score={personalRisk.skillRelevanceScore}
            riskBand={personalRisk.personalRiskBand} />

          {/* F22: Score delta from previous assessment */}
          {scoreDelta && scoreDelta.scoreDelta !== 0 && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <DeltaBadge delta={scoreDelta.scoreDelta} label="points" size="md" />
              {scoreDelta.daysSinceLast > 0 && (
                <span className="text-[10px] text-dark-textMuted flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  since {scoreDelta.daysSinceLast} days ago
                </span>
              )}
            </div>
          )}
        </Card>

        {/* Key Metrics */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            title="Role Automation Risk"
            value={personalRisk.roleAutomationRisk}
            detail="34% of your core tasks are automatable. Lower than average for COOs — your strategic focus protects you."
            inverse />

          <MetricCard
            title="Adaptability Index"
            value={personalRisk.adaptabilityIndex}
            detail="Strong change management background and cross-functional experience give you high adaptability." />

          <MetricCard
            title="Network Leverage"
            value={personalRisk.networkLeverage}
            detail="500+ connections with strong C-suite density. Your network is a significant asset for AI adoption." />

          <MetricCard
            title="Leadership Readiness"
            value={personalRisk.leadershipAIReadiness}
            detail="Team AI literacy and governance gaps are holding back your leadership readiness score."
            warning />

        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-8">
          <h3 className="text-lg font-bold text-dark-textPri mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-dark-green/10 text-dark-green flex items-center justify-center text-sm">
              ✓
            </span>
            Key Strengths
          </h3>
          <ul className="space-y-6">
            {personalRisk.keyStrengths.map((strength, i) =>
            <li key={i} className="group">
                <div className="font-bold text-dark-textPri mb-1 group-hover:text-dark-accent transition-colors">
                  {strength.title}
                </div>
                <div className="text-dark-textSec text-sm leading-relaxed">
                  {strength.detail}
                </div>
              </li>
            )}
          </ul>
        </Card>

        <Card className="p-8">
          <h3 className="text-lg font-bold text-dark-textPri mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-dark-red/10 text-dark-red flex items-center justify-center text-sm">
              !
            </span>
            Critical Vulnerabilities
          </h3>
          <ul className="space-y-6">
            {personalRisk.vulnerabilities.map((vuln, i) =>
            <li key={i} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-dark-textPri group-hover:text-dark-red transition-colors">
                    {vuln.title}
                  </div>
                  <UrgencyBadge level={vuln.urgency} />
                </div>
                <div className="text-dark-textSec text-sm leading-relaxed">
                  {vuln.detail}
                </div>
              </li>
            )}
          </ul>
        </Card>
      </div>

      {/* Industry Context Card */}
      <Card className="p-8 bg-dark-elevated border-dark-border">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-6 h-6 text-dark-textMuted" />
          <h3 className="text-lg font-bold text-dark-textPri">
            Industry Context: {industryContext.name}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-4 bg-dark-card rounded-lg border border-dark-border">
            <div className="text-3xl font-bold text-dark-accent mb-1">
              {industryContext.aiAdoptionRate}%
            </div>
            <div className="text-xs text-dark-textMuted uppercase tracking-wide font-semibold">
              Sector Adoption Rate
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-1 h-12 bg-red-400 rounded-full flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-dark-red uppercase tracking-wide mb-1">
                  Top Threat
                </div>
                <p className="text-dark-textPri font-medium">
                  {industryContext.topThreat}
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-1 h-12 bg-green-400 rounded-full flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-dark-green uppercase tracking-wide mb-1">
                  Top Opportunity
                </div>
                <p className="text-dark-textPri font-medium">
                  {industryContext.topOpportunity}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>);

}
function DetailPill({ icon: Icon, label }: {icon: any;label: string;}) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-dark-elevated text-dark-textSec text-sm border border-dark-border">
      <Icon className="w-3.5 h-3.5 mr-2 text-dark-textMuted" />
      {label}
    </span>);

}
function UrgencyBadge({ level }: {level: 'high' | 'medium' | 'low';}) {
  const styles = {
    high: 'bg-dark-red/10 text-dark-red border-dark-red/20',
    medium: 'bg-dark-amber/10 text-dark-amber border-dark-amber/20',
    low: 'bg-dark-green/10 text-dark-green border-dark-green/20'
  };
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles[level]}`}>

      {level} Urgency
    </span>);

}
function MetricCard({
  title,
  value,
  detail,
  inverse,
  warning
}: {title: string;value: number;detail: string;inverse?: boolean;warning?: boolean;}) {
  const getStatus = () => {
    if (warning)
    return {
      color: 'text-dark-amber',
      bg: 'bg-amber-600',
      bar: 'bg-amber-500',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      label: 'Needs Attention'
    };
    if (inverse) {
      return value > 50 ?
      {
        color: 'text-dark-red',
        bg: 'bg-red-600',
        bar: 'bg-red-500',
        icon: ShieldAlert,
        iconColor: 'text-red-500',
        label: 'High Risk'
      } :
      {
        color: 'text-dark-green',
        bg: 'bg-green-600',
        bar: 'bg-green-500',
        icon: CheckCircle2,
        iconColor: 'text-green-500',
        label: 'Low Risk'
      };
    }
    return value > 70 ?
    {
      color: 'text-dark-green',
      bg: 'bg-green-600',
      bar: 'bg-green-500',
      icon: CheckCircle2,
      iconColor: 'text-green-500',
      label: 'Strong'
    } :
    value > 50 ?
    {
      color: 'text-dark-textPri',
      bg: 'bg-gray-700',
      bar: 'bg-gray-500',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      label: 'Moderate'
    } :
    {
      color: 'text-dark-red',
      bg: 'bg-red-600',
      bar: 'bg-red-500',
      icon: ShieldAlert,
      iconColor: 'text-red-500',
      label: 'At Risk'
    };
  };
  const status = getStatus();
  const StatusIcon = status.icon;
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm text-dark-textMuted font-semibold">{title}</span>
        <div className="flex items-center gap-1.5">
          <StatusIcon className={`w-4 h-4 ${status.iconColor}`} />
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${status.iconColor}`}>

            {status.label}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className={`text-4xl font-bold ${status.color}`}>{value}%</span>
      </div>

      <div className="mb-3">
        <div className="h-2 w-full bg-dark-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${status.bar}`}
            style={{
              width: `${value}%`
            }} />

        </div>
      </div>

      <p className="text-xs text-dark-textMuted leading-relaxed">{detail}</p>
    </Card>);

}