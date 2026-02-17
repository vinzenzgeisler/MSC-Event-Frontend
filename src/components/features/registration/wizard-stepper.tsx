const steps = ["Fahrer", "Startmeldungen", "Zusammenfassung"];

type WizardStepperProps = {
  currentStep: number;
};

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="grid grid-cols-3 gap-2 overflow-x-auto">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === currentStep;
        const done = stepNumber < currentStep;

        return (
          <div
            key={step}
            className={[
              "min-w-0 rounded-lg border px-2 py-2 text-xs md:px-3 md:text-sm",
              done ? "border-blue-300 bg-blue-50 text-blue-900" : "",
              active ? "border-blue-600 bg-blue-600 text-white" : "",
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
