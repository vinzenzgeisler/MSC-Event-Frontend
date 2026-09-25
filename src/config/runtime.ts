const runtimeConfig = typeof window === 'undefined' ? undefined : window.__MSC_RUNTIME_CONFIG__;

const booleanValue = (value: unknown): boolean => value === true || value === 'true';

export const isRacePicEnabled = (): boolean => booleanValue(
  runtimeConfig?.racepicEnabled ?? runtimeConfig?.VITE_ENABLE_RACEPIC ?? import.meta.env.VITE_ENABLE_RACEPIC
);
