import type { ProviderEmbeddingEnvironment } from './provider-embedding-gate';

export type SupportedSiteRuntimeGrantRuntimeContract = {
  environment: ProviderEmbeddingEnvironment;
  providerKey: string;
  model: string;
  supported: true;
};

export type UnsupportedSiteRuntimeGrantRuntimeContract = {
  environment: ProviderEmbeddingEnvironment | null;
  providerKey: string;
  model: string;
  supported: false;
  reason: 'invalid_deployment_environment' | 'unsupported_provider_configuration';
};

export type SiteRuntimeGrantRuntimeContract =
  | SupportedSiteRuntimeGrantRuntimeContract
  | UnsupportedSiteRuntimeGrantRuntimeContract;

export type ResolvedRuntimeEmbeddingConfig = {
  providerKey: string;
  model: string;
};

export type SiteRuntimeGrantDeploymentEnvironmentResolution =
  | { supported: true; environment: ProviderEmbeddingEnvironment }
  | { supported: false; reason: 'invalid_deployment_environment' };

export function resolveSiteRuntimeGrantDeploymentEnvironment(
  nodeEnv = process.env.NODE_ENV,
  appEnv = process.env.APP_ENV,
): SiteRuntimeGrantDeploymentEnvironmentResolution {
  if (appEnv === undefined) {
    return {
      supported: true,
      environment: nodeEnv === 'production' ? 'production' : 'non_production',
    };
  }

  if (appEnv === 'staging') {
    return { supported: true, environment: 'non_production' };
  }

  if (appEnv === 'production' && nodeEnv === 'production') {
    return { supported: true, environment: 'production' };
  }

  return { supported: false, reason: 'invalid_deployment_environment' };
}

/**
 * This is configuration resolution only. It never constructs an embedding client
 * or calls a provider, so grant administration cannot activate provider traffic.
 */
export function buildSiteRuntimeGrantRuntimeContract(
  config: ResolvedRuntimeEmbeddingConfig,
  providerSupported: boolean,
  nodeEnv = process.env.NODE_ENV,
  appEnv = process.env.APP_ENV,
): SiteRuntimeGrantRuntimeContract {
  const deploymentEnvironment = resolveSiteRuntimeGrantDeploymentEnvironment(nodeEnv, appEnv);
  if (!deploymentEnvironment.supported) {
    return {
      environment: null,
      providerKey: config.providerKey,
      model: config.model,
      supported: false,
      reason: deploymentEnvironment.reason,
    };
  }

  if (!providerSupported) {
    return {
      environment: deploymentEnvironment.environment,
      providerKey: config.providerKey,
      model: config.model,
      supported: false,
      reason: 'unsupported_provider_configuration',
    };
  }

  return {
    environment: deploymentEnvironment.environment,
    providerKey: config.providerKey,
    model: config.model,
    supported: true,
  };
}
