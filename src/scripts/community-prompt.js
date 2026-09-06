import {
  trackCommunityPromptClicked,
  trackCommunityPromptDismissed,
  trackCommunityPromptViewed
} from './analytics.js';

export const COMMUNITY_PROMPT_STORAGE_KEY = 'fiestasMonte:community-prompt:v1';
export const COMMUNITY_PROMPT_ACTIVE_SESSION_KEY = 'fiestasMonte:community-prompt:active:v1';
export const COMMUNITY_PROMPT_SCHEMA_VERSION = 1;
export const COMMUNITY_PROMPT_MAX_EXPOSURES = 2;
export const COMMUNITY_PROMPT_SNOOZE_DAYS = 5;
export const COMMUNITY_PROMPT_SNOOZE_MS = COMMUNITY_PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000;

export const DEFAULT_COMMUNITY_PROMPT_CAMPAIGN = Object.freeze({
  id: 'montemayor-2026',
  startDate: '2026-09-06',
  endDate: '2026-09-18'
});

const RELEVANT_ENGAGEMENTS = new Set([
  'activity:save',
  'activity:share',
  'plan:add_community',
  'plan:share'
]);

const EMPTY_STATE = Object.freeze({
  schemaVersion: COMMUNITY_PROMPT_SCHEMA_VERSION,
  campaignId: DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.id,
  exposureCount: 0,
  lastShownAt: 0,
  nextEligibleAt: 0,
  neverAgain: false,
  relevantActionSeen: false
});

export function createCommunityPromptState(campaignId = DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.id) {
  return {
    ...EMPTY_STATE,
    campaignId: String(campaignId || DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.id)
  };
}

export function normalizeCommunityPromptState(value, campaignId = DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.id) {
  const expectedCampaignId = String(campaignId || DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.id);
  if (!value || typeof value !== 'object' || value.schemaVersion !== COMMUNITY_PROMPT_SCHEMA_VERSION || value.campaignId !== expectedCampaignId) {
    return createCommunityPromptState(expectedCampaignId);
  }

  const exposureCount = Number(value.exposureCount);
  const lastShownAt = Number(value.lastShownAt);
  const nextEligibleAt = Number(value.nextEligibleAt);
  return {
    schemaVersion: COMMUNITY_PROMPT_SCHEMA_VERSION,
    campaignId: expectedCampaignId,
    exposureCount: Number.isInteger(exposureCount) ? Math.min(Math.max(exposureCount, 0), COMMUNITY_PROMPT_MAX_EXPOSURES) : 0,
    lastShownAt: Number.isFinite(lastShownAt) && lastShownAt >= 0 ? lastShownAt : 0,
    nextEligibleAt: Number.isFinite(nextEligibleAt) && nextEligibleAt >= 0 ? nextEligibleAt : 0,
    neverAgain: value.neverAgain === true,
    relevantActionSeen: value.relevantActionSeen === true
  };
}

export function readCommunityPromptState(storage, campaignId = DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.id) {
  if (!storage || typeof storage.getItem !== 'function') return createCommunityPromptState(campaignId);
  try {
    const raw = storage.getItem(COMMUNITY_PROMPT_STORAGE_KEY);
    return normalizeCommunityPromptState(raw ? JSON.parse(raw) : null, campaignId);
  } catch (_) {
    return createCommunityPromptState(campaignId);
  }
}

export function writeCommunityPromptState(storage, state) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(COMMUNITY_PROMPT_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (_) {
    return false;
  }
}

export function isCommunityPromptCampaignActive(campaign, now = Date.now()) {
  const start = localDateBoundary(campaign?.startDate, false);
  const end = localDateBoundary(campaign?.endDate, true);
  return start !== null && end !== null && now >= start && now <= end;
}

export function canShowCommunityPrompt({ state, campaign, now = Date.now() }) {
  if (!isCommunityPromptCampaignActive(campaign, now)) return false;
  if (!state || state.neverAgain || state.exposureCount >= COMMUNITY_PROMPT_MAX_EXPOSURES) return false;
  if (Number(state.nextEligibleAt) > now) return false;
  return state.relevantActionSeen === true;
}

export function recordCommunityPromptExposure(state, now = Date.now()) {
  return {
    ...state,
    exposureCount: Math.min(state.exposureCount + 1, COMMUNITY_PROMPT_MAX_EXPOSURES),
    lastShownAt: now
  };
}

export function recordCommunityPromptSnooze(state, now = Date.now()) {
  return { ...state, nextEligibleAt: now + COMMUNITY_PROMPT_SNOOZE_MS };
}

export function recordCommunityPromptNeverAgain(state) {
  return { ...state, neverAgain: true, nextEligibleAt: 0 };
}

export function isRelevantCommunityEngagement(detail) {
  if (!detail || typeof detail !== 'object') return false;
  return RELEVANT_ENGAGEMENTS.has(`${String(detail.category || '')}:${String(detail.action || '')}`);
}

function localDateBoundary(value, endOfDay) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch (_) {
    return null;
  }
}

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch (_) {
    return null;
  }
}

function hasActivePromptInSession(storage) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  try {
    return Boolean(storage.getItem(COMMUNITY_PROMPT_ACTIVE_SESSION_KEY));
  } catch (_) {
    return false;
  }
}

function setActivePromptInSession(storage, active) {
  if (!storage) return false;
  try {
    if (active && typeof storage.setItem === 'function') storage.setItem(COMMUNITY_PROMPT_ACTIVE_SESSION_KEY, String(Date.now()));
    else if (!active && typeof storage.removeItem === 'function') storage.removeItem(COMMUNITY_PROMPT_ACTIVE_SESSION_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

function hasBlockingOverlay() {
  return Boolean(document.querySelector([
    '[data-menu-drawer]:not([hidden])',
    '[data-subscribe-modal]:not([hidden])',
    '[data-fiestas-detail-calendar-modal]:not([hidden])',
    '[data-fiestas-event-options]:not([hidden])',
    '[data-plan-calendar-dialog]:not([hidden])',
    '[data-plan-share-dialog]:not([hidden])',
    '[data-pwa-ios-help]:not([hidden])',
    '[data-pwa-install-progress]:not([hidden])'
  ].join(', ')));
}

export function setupCommunityPrompt() {
  const prompt = document.querySelector('[data-community-prompt]');
  if (!prompt) return null;

  const panel = prompt.querySelector('.community-prompt-panel');
  const dismissButton = prompt.querySelector('[data-community-prompt-dismiss]');
  const neverButton = prompt.querySelector('[data-community-prompt-never]');
  const channelLinks = [...prompt.querySelectorAll('[data-community-prompt-channel]')];
  if (!panel || !dismissButton || !neverButton) return null;

  const campaign = {
    id: prompt.dataset.communityPromptCampaignId || DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.id,
    startDate: prompt.dataset.communityPromptStart || DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.startDate,
    endDate: prompt.dataset.communityPromptEnd || DEFAULT_COMMUNITY_PROMPT_CAMPAIGN.endDate
  };
  const storage = getStorage();
  const sessionStorage = getSessionStorage();
  let state = readCommunityPromptState(storage, campaign.id);
  let isOpen = false;
  let isActiveInSession = hasActivePromptInSession(sessionStorage);

  const persist = () => writeCommunityPromptState(storage, state);

  const hide = () => {
    prompt.hidden = true;
    isOpen = false;
    isActiveInSession = false;
    setActivePromptInSession(sessionStorage, false);
  };

  const show = () => {
    if (isOpen || isActiveInSession || hasBlockingOverlay() || !canShowCommunityPrompt({ state, campaign })) return false;
    state = recordCommunityPromptExposure(state);
    persist();
    prompt.hidden = false;
    isOpen = true;
    isActiveInSession = true;
    trackCommunityPromptViewed(state.exposureCount);
    return true;
  };

  const snooze = () => {
    if (!isOpen) return;
    const iteration = state.exposureCount;
    state = recordCommunityPromptSnooze(state);
    persist();
    hide();
    trackCommunityPromptDismissed('snooze_5d', iteration);
  };

  const neverAgain = () => {
    if (!isOpen) return;
    const iteration = state.exposureCount;
    state = recordCommunityPromptNeverAgain(state);
    persist();
    hide();
    trackCommunityPromptDismissed('never_again', iteration);
  };

  dismissButton.addEventListener('click', snooze);
  neverButton.addEventListener('click', neverAgain);
  channelLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (!isOpen) return;
      const iteration = state.exposureCount;
      state = recordCommunityPromptSnooze(state);
      persist();
      trackCommunityPromptClicked(link.dataset.communityPromptChannel, iteration);
      hide();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (isOpen && event.key === 'Escape') {
      event.preventDefault();
      snooze();
    }
  });

  window.addEventListener('fiestas:engagement', (event) => {
    if (!isRelevantCommunityEngagement(event.detail)) return;
    state = { ...state, relevantActionSeen: true };
    persist();
    window.setTimeout(show, 240);
  });

  return { show, hide, getState: () => ({ ...state }) };
}

if (typeof document !== 'undefined' && typeof document.querySelector === 'function') setupCommunityPrompt();
