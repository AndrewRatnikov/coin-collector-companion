'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import type { Step } from '@/lib/new-set-entry';

export interface SetNewStepperProps {
  step: Step;
  onStepOneClick: () => void;
}

/** The two-step indicator; step 1 is a button that goes back to the start options. */
export function SetNewStepper({ step, onStepOneClick }: SetNewStepperProps) {
  const { t } = useTranslation();
  return (
    <ol
      data-testid="set-new-stepper"
      aria-label={t('setNew.stepsLabel')}
      className="flex items-center gap-3"
    >
      <li>
        <button
          type="button"
          data-testid="set-new-stepper-1"
          aria-current={step === 1 ? 'step' : undefined}
          onClick={() => onStepOneClick()}
          className="flex items-center gap-2 text-sm font-medium text-neutral-800 hover:text-accent-700"
        >
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
              step === 1 ? 'bg-accent-700 font-mono text-white' : 'bg-accent text-white'
            }`}
          >
            {step === 1 ? '1' : '✓'}
          </span>
          {t('setNew.stepStart')}
        </button>
      </li>
      <li aria-hidden="true" className="h-px w-10 bg-neutral-400" />
      <li
        data-testid="set-new-stepper-2"
        aria-current={step === 2 ? 'step' : undefined}
        className="flex items-center gap-2 text-sm font-medium text-neutral-800"
      >
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm ${
            step === 2
              ? 'bg-accent-700 text-white'
              : 'border-[1.5px] border-neutral-500 text-neutral-700'
          }`}
        >
          2
        </span>
        {t('setNew.stepCreate')}
      </li>
    </ol>
  );
}
