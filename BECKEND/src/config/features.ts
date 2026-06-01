function isEnabled(value: string | undefined): boolean {
  return value === 'true';
}

export const FEATURES = {
  whatsapp: isEnabled(process.env.WHATSAPP_ENABLED),
};

export function assertFeatureEnabled(featureName: keyof typeof FEATURES, source: string): void {
  if (!FEATURES[featureName]) {
    throw new Error(`[${source}] modulo temporariamente desabilitado`);
  }
}
