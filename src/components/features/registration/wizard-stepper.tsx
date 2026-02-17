const steps = ["Fahrer", "Startmeldungen", "Zusammenfassung"];

type WizardStepperProps = {
  currentStep: number;
};

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === currentStep;
        const done = stepNumber < currentStep;

        return (
          <div
            key={step}
            className={[
              "rounded-lg border px-3 py-2 text-xs md:text-sm",
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
