import {
  normalizeCommercialActivities,
  normalizeCommercialConversions,
  normalizeCommercialOpportunities,
  normalizeCommercialPipeline,
  normalizeCommercialProposals,
} from '../v4-painel/integration/adapters/commercialAdapter.js';
import { ensureNoProductionMock, requestV4 } from './v4ServiceUtils.js';

export async function getCommercialPipeline() {
  const payload = await requestV4('get', '/commercial/pipeline', {
    operation: 'commercial.pipeline.read',
  });
  return normalizeCommercialPipeline(ensureNoProductionMock(payload, 'commercial.pipeline.read'));
}

export async function listCommercialOpportunities(params = {}) {
  const payload = await requestV4('get', '/commercial/opportunities', {
    operation: 'commercial.opportunities.read',
    params,
  });
  return normalizeCommercialOpportunities(ensureNoProductionMock(payload, 'commercial.opportunities.read'));
}

export async function listCommercialProposals(params = {}) {
  const payload = await requestV4('get', '/commercial/proposals', {
    operation: 'commercial.proposals.read',
    params,
  });
  return normalizeCommercialProposals(ensureNoProductionMock(payload, 'commercial.proposals.read'));
}

export async function getCommercialConversions(params = {}) {
  const payload = await requestV4('get', '/commercial/conversions', {
    operation: 'commercial.conversions.read',
    params,
  });
  return normalizeCommercialConversions(ensureNoProductionMock(payload, 'commercial.conversions.read'));
}

export async function listCommercialActivities(params = {}) {
  const payload = await requestV4('get', '/commercial/activities', {
    operation: 'commercial.activities.read',
    params,
  });
  return normalizeCommercialActivities(ensureNoProductionMock(payload, 'commercial.activities.read'));
}

export async function createOpportunity(payload) {
  const result = await requestV4('post', '/commercial/opportunities', {
    operation: 'commercial.opportunity.create',
    data: payload,
  });
  return normalizeCommercialOpportunities({ opportunities: [result?.opportunity ?? result] })[0] ?? result;
}

export async function updateOpportunity(id, payload) {
  const result = await requestV4('patch', `/commercial/opportunities/${id}`, {
    operation: 'commercial.opportunity.update',
    data: payload,
  });
  return normalizeCommercialOpportunities({ opportunities: [result?.opportunity ?? result] })[0] ?? result;
}

export async function changeOpportunityStage(id, stage) {
  const result = await requestV4('patch', `/commercial/opportunities/${id}/stage`, {
    operation: 'commercial.opportunity.stage.change',
    data: { stage },
  });
  return normalizeCommercialOpportunities({ opportunities: [result?.opportunity ?? result] })[0] ?? result;
}

export async function createProposal(payload) {
  const result = await requestV4('post', '/commercial/proposals', {
    operation: 'commercial.proposal.create',
    data: payload,
  });
  return result?.proposal ?? result;
}

export async function updateProposal(id, payload) {
  const result = await requestV4('patch', `/commercial/proposals/${id}`, {
    operation: 'commercial.proposal.update',
    data: payload,
  });
  return result?.proposal ?? result;
}

export async function convertProposal(id, payload = {}) {
  const result = await requestV4('post', `/commercial/proposals/${id}/convert`, {
    operation: 'commercial.proposal.convert',
    data: payload,
  });
  return result?.conversion ?? result;
}

export async function createCommercialActivity(payload) {
  const result = await requestV4('post', '/commercial/activities', {
    operation: 'commercial.activity.create',
    data: payload,
  });
  return normalizeCommercialActivities({ activities: [result?.activity ?? result] })[0] ?? result;
}
