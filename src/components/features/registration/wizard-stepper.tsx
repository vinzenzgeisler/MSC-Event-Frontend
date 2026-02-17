import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";

type WizardStepperProps = {
  currentStep: number;
};

export function WizardStepper({ currentStep }: WizardStepperProps) {
  const { m } = useAnmeldungI18n();
  const steps = [m.stepper.driver, m.stepper.starts, m.stepper.summary];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === currentStep;
        const done = stepNumber < currentStep;

        return (
          <div
            key={step}
            className={[
              "min-w-[140px] flex-1 rounded-lg border px-2 py-2 text-xs sm:min-w-0 md:px-3 md:text-sm",
              done ? "border-primary/35 bg-primary/10 text-primary" : "",
              active ? "border-primary bg-primary text-primary-foreground" : "",
              !done && !active ? "border-slate-200 bg-white text-slate-500" : ""
            ].join(" ")}
          >
            <div className="font-semibold">{stepNumber}. {step}</div>
          </div>
        );
      })}
    </div>
  );
}
