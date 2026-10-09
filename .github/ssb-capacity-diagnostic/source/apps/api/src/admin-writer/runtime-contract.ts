import { privateFile } from './private-file';
import { runtimeState } from '../maintenance/maintenance-runtime';
import { buildSiteRuntimeGrantRuntimeContract, resolveSiteRuntimeLlmGrantRuntimeContract,
  type SiteRuntimeGrantRuntimeContract } from '../knowledge-sources/site-runtime-grant-runtime-contract';
import { resolveEmbeddingConfig, supportsEmbeddingConfig } from '../vector/embedding-config';

/** Read-only deployment metadata shared with the API, never a provider credential. */
export function writerRuntimeContract(purpose: 'query_embedding' | 'llm_generation'): SiteRuntimeGrantRuntimeContract {
  const binding = JSON.parse(privateFile(process.env.ADMIN_WRITER_RUNTIME_FILE));
  const state = runtimeState();
  if (!state || binding.version !== 1 || binding.service !== state.binding.service
    || binding.generation !== state.binding.generation) throw new Error('Writer runtime binding invalid');
  const value = binding[purpose];
  if (!value || value.providerKey !== 'openai' || typeof value.model !== 'string'
    || !(value.supported === false && value.model === '' || /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value.model))
    || typeof value.supported !== 'boolean') throw new Error('Writer runtime contract invalid');
  const contract = buildSiteRuntimeGrantRuntimeContract(value, value.supported);
  if (contract.environment !== binding.environment) throw new Error('Writer deployment mismatch');
  return contract;
}

export function assertRuntimeGrantBinding() {
  const embedding = resolveEmbeddingConfig();
  const contracts = {
    query_embedding: buildSiteRuntimeGrantRuntimeContract(embedding, supportsEmbeddingConfig(embedding)),
    llm_generation: resolveSiteRuntimeLlmGrantRuntimeContract(),
  };
  for (const purpose of ['query_embedding','llm_generation'] as const) {
    const actual = contracts[purpose], expected = writerRuntimeContract(purpose);
    for (const field of ['environment','providerKey','model','supported'] as const)
      if (actual[field] !== expected[field]) throw new Error('API/writer runtime configuration mismatch');
  }
}
