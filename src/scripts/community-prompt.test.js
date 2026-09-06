import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canShowCommunityPrompt,
  DEFAULT_COMMUNITY_PROMPT_CAMPAIGN,
  isCommunityPromptCampaignActive,
  isRelevantCommunityEngagement,
  normalizeCommunityPromptState,
  recordCommunityPromptExposure
} from './community-prompt.js';

test('community prompt uses the Montemayor campaign window', () => {
  assert.equal(
    isCommunityPromptCampaignActive(DEFAULT_COMMUNITY_PROMPT_CAMPAIGN, new Date(2026, 8, 10, 12).getTime()),
    true
  );
  assert.equal(
    isCommunityPromptCampaignActive(DEFAULT_COMMUNITY_PROMPT_CAMPAIGN, new Date(2026, 8, 19, 12).getTime()),
    false
  );
});

test('community prompt only becomes eligible after a relevant local action', () => {
  const campaign = DEFAULT_COMMUNITY_PROMPT_CAMPAIGN;
  const now = new Date(2026, 8, 10, 12).getTime();
  const state = normalizeCommunityPromptState(null, campaign.id);

  assert.equal(canShowCommunityPrompt({ state, campaign, now }), false);
  assert.equal(isRelevantCommunityEngagement({ category: 'activity', action: 'save' }), true);
  assert.equal(isRelevantCommunityEngagement({ category: 'activity', action: 'open_activity' }), false);

  const engaged = { ...state, relevantActionSeen: true };
  assert.equal(canShowCommunityPrompt({ state: engaged, campaign, now }), true);
  assert.equal(canShowCommunityPrompt({ state: recordCommunityPromptExposure(engaged, now), campaign, now }), true);
  assert.equal(canShowCommunityPrompt({ state: { ...engaged, exposureCount: 2 }, campaign, now }), false);
});
