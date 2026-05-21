"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { WizardOptionList, type WizardOption } from "@/components/leagues/WizardOptionList";
import type { SleeperConnectMode } from "@/hooks/useSleeperConnect";

export type WizardStep = 1 | 2 | 3;

const FULL_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Username" },
  { step: 2, label: "League" },
  { step: 3, label: "Team" },
];

const LEAGUE_ONLY_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Username" },
  { step: 2, label: "League" },
];

type StepCopy = { title: string; helper: string; primaryLabel: string; loadingHint?: string };

const FULL_STEP_COPY: Record<WizardStep, StepCopy> = {
  1: {
    title: "Connect Sleeper",
    helper: "Enter your Sleeper handle to load dynasty leagues.",
    primaryLabel: "Find leagues",
  },
  2: {
    title: "Choose a league",
    helper: "Dynasty leagues from this season and last.",
    primaryLabel: "Continue",
    loadingHint: "Loading leagues…",
  },
  3: {
    title: "Choose your team",
    helper: "We'll rank your roster and surface trade ideas.",
    primaryLabel: "Analyze roster",
    loadingHint: "Loading teams…",
  },
};

const LEAGUE_ONLY_STEP_COPY: Record<1 | 2, StepCopy> = {
  1: {
    title: "Connect Sleeper",
    helper: "Enter your Sleeper handle to load dynasty leagues.",
    primaryLabel: "Find leagues",
  },
  2: {
    title: "Choose a league",
    helper: "Pick the dynasty league whose history you want to explore.",
    primaryLabel: "Load league history",
    loadingHint: "Loading leagues…",
  },
};

function leagueOnlyStepCopy(primaryLabel: string): Record<1 | 2, StepCopy> {
  return {
    1: LEAGUE_ONLY_STEP_COPY[1],
    2: {
      ...LEAGUE_ONLY_STEP_COPY[2],
      helper: "Pick the dynasty league whose drafts you want to grade.",
      primaryLabel,
    },
  };
}

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

const btnPrimary = `${btnPress} inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] bg-dash-primary text-sm font-semibold text-dash-text hover:bg-dash-primary/90`;

const btnSecondary = `${btnPress} inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-sm font-medium text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text`;

const linkAction =
  "cursor-pointer text-sm font-semibold text-dash-primary hover:text-dash-text motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface rounded-[var(--dash-radius-sm)]";

const fieldClass =
  "leagues-connect-row w-full min-h-11 rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/35 px-3 py-2 text-sm text-dash-text placeholder:text-dash-text/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

type Props = {
  mode?: SleeperConnectMode;
  /** Step 2 primary button when `mode="league-only"` (default: Load league history). */
  leagueOnlyPrimaryLabel?: string;
  step: WizardStep;
  username: string;
  onUsernameChange: (value: string) => void;
  leagueOptions: WizardOption[];
  teamOptions: WizardOption[];
  selectedLeagueId: string;
  selectedRosterId: string;
  leaguesLoading: boolean;
  teamsLoading: boolean;
  loading: boolean;
  canAnalyze: boolean;
  canProceedFromLeague?: boolean;
  leagueEmptyMessage?: string;
  teamEmptyMessage?: string;
  onConnect: () => void;
  onLeagueSelect: (leagueId: string) => void;
  onTeamSelect: (rosterId: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
  onOpenUsernameHelp: () => void;
};

export function SleeperConnectWizard({
  mode = "full",
  leagueOnlyPrimaryLabel = "Load league history",
  step,
  username,
  onUsernameChange,
  leagueOptions,
  teamOptions,
  selectedLeagueId,
  selectedRosterId,
  leaguesLoading,
  teamsLoading,
  loading,
  canAnalyze,
  canProceedFromLeague = false,
  leagueEmptyMessage,
  teamEmptyMessage,
  onConnect,
  onLeagueSelect,
  onTeamSelect,
  onAnalyze,
  onBack,
  onOpenUsernameHelp,
}: Props) {
  const titleId = useId();
  const stepBodyRef = useRef<HTMLDivElement>(null);
  const isLeagueOnly = mode === "league-only";

  const steps = isLeagueOnly ? LEAGUE_ONLY_STEPS : FULL_STEPS;
  const leagueOnlyCopy = leagueOnlyStepCopy(leagueOnlyPrimaryLabel);
  const copy = isLeagueOnly ? leagueOnlyCopy[step as 1 | 2] : FULL_STEP_COPY[step];

  useEffect(() => {
    requestAnimationFrame(() => {
      const focusTarget =
        stepBodyRef.current?.querySelector<HTMLElement>(
          "input, button[role='radio'][aria-checked='true'], button[role='radio']",
        ) ?? stepBodyRef.current?.querySelector<HTMLElement>("h2");
      focusTarget?.focus();
    });
  }, [step]);

  const handlePrimary = () => {
    if (step === 1) onConnect();
    else onAnalyze();
  };

  const primaryDisabled = useMemo(() => {
    if (loading) return true;
    if (step === 1) return !username.trim();
    if (isLeagueOnly && step === 2) return !canProceedFromLeague;
    if (step === 3) return !canAnalyze;
    return false;
  }, [loading, step, username, isLeagueOnly, canProceedFromLeague, canAnalyze]);

  const showBack = step > 1;
  const showPrimary = step === 1 || (isLeagueOnly ? step === 2 : step === 3);
  const listLoading = step === 2 ? leaguesLoading : step === 3 ? teamsLoading : false;

  if (isLeagueOnly && step === 3) {
    return null;
  }

  return (
    <section
      className="flex min-h-[calc(100dvh-4.25rem)] flex-col justify-start pt-8 sm:pt-12 lg:pt-16 pb-12"
      aria-labelledby={titleId}
    >
      <div className="mx-auto w-full max-w-lg sm:max-w-xl space-y-8">
        <nav aria-label="Connect progress" className="flex items-center justify-center gap-2 sm:gap-4">
          {steps.map(({ step: s, label }, i) => {
            const done = s < step;
            const current = s === step;
            return (
              <div key={s} className="flex items-center gap-2 sm:gap-4">
                {i > 0 ? (
                  <span
                    className={`hidden sm:block h-px w-6 sm:w-10 ${done ? "bg-dash-primary/60" : "bg-white/15"}`}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
                    current ? "text-dash-text" : done ? "text-dash-primary" : "text-dash-text/50"
                  }`}
                  aria-current={current ? "step" : undefined}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums ${
                      current
                        ? "bg-dash-primary text-dash-text"
                        : done
                          ? "border border-dash-primary/50 text-dash-primary"
                          : "border border-white/20 text-dash-text/55"
                    }`}
                  >
                    {s}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </div>
            );
          })}
        </nav>

        <div key={step} ref={stepBodyRef} className="leagues-wizard-step-enter space-y-6">
          <header className="space-y-2 text-center sm:text-left">
            <h2 id={titleId} className="dash-heading-section text-dash-text">
              {copy.title}
            </h2>
            <p className="text-sm text-dash-text/75 leading-relaxed max-w-prose">{copy.helper}</p>
            {listLoading && copy.loadingHint ? (
              <p className="text-sm text-dash-text/60" aria-live="polite">
                {copy.loadingHint}
              </p>
            ) : null}
          </header>

          {step === 1 ? (
            <div className="space-y-4">
              <label htmlFor="sleeper-username-wizard" className="sr-only">
                Sleeper username
              </label>
              <input
                id="sleeper-username-wizard"
                className={fieldClass}
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="Sleeper handle"
                autoComplete="off"
                name="sleeper-username-field"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && username.trim() && !loading) onConnect();
                }}
              />
              <p className="text-sm text-dash-text/75 text-center sm:text-left">
                <button type="button" className={`${linkAction} font-semibold`} onClick={onOpenUsernameHelp}>
                  How do I find my Sleeper username?
                </button>
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <WizardOptionList
              id="wizard-league"
              label="League"
              value={selectedLeagueId}
              options={leagueOptions}
              loading={leaguesLoading}
              emptyMessage={leagueEmptyMessage}
              disabled={loading}
              onChange={onLeagueSelect}
            />
          ) : null}

          {!isLeagueOnly && step === 3 ? (
            <WizardOptionList
              id="wizard-team"
              label="Team"
              value={selectedRosterId}
              options={teamOptions}
              loading={teamsLoading}
              emptyMessage={teamEmptyMessage}
              disabled={loading}
              onChange={onTeamSelect}
            />
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            {showBack ? (
              <button type="button" className={btnSecondary} disabled={loading} onClick={onBack}>
                Back
              </button>
            ) : (
              <span className="hidden sm:block" aria-hidden />
            )}
            {showPrimary ? (
              <button
                type="button"
                className={`${btnPrimary} w-full sm:w-auto sm:ml-auto`}
                disabled={primaryDisabled}
                aria-busy={loading}
                onClick={handlePrimary}
              >
                {loading ? `${copy.primaryLabel}…` : copy.primaryLabel}
              </button>
            ) : (
              <span className="text-sm text-dash-text/60 sm:ml-auto" aria-live="polite">
                {teamsLoading ? "Loading teams…" : selectedLeagueId ? "Preparing team list…" : "Select a league"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
