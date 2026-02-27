import { GuidanceCard, UserProfile } from '../types';

export const AQI_THRESHOLDS = {
  Good: 50,
  Moderate: 100,
  UnhealthySensitive: 150,
  Unhealthy: 200,
  VeryUnhealthy: 300,
};

// ─── Pollutant display labels ─────────────────────────────────────────────────

export const POLLUTANT_DISPLAY: Record<string, string> = {
  pm25: 'PM2.5', pm10: 'PM10', o3: 'Ozone', no2: 'NO₂', co: 'CO', so2: 'SO₂',
};

export function pollutantLabel(key: string): string {
  return POLLUTANT_DISPLAY[key.toLowerCase()] ?? key.toUpperCase();
}

// ─── Hardcoded guidance rules ─────────────────────────────────────────────────

type ProfileType = UserProfile['type'];
interface Rule { emoji: string; message: string; detail: string }

const GOOD_ALL: Rule = {
  emoji: '😊',
  message: 'Great air — enjoy the outdoors.',
  detail: 'Clean air day. No restrictions for anyone.',
};

const HAZARDOUS_ALL: Rule = {
  emoji: '🚨',
  message: 'Hazardous air. Stay indoors now.',
  detail: 'Like smoking a pack of cigarettes per day outside.',
};

const MODERATE: Record<ProfileType, Rule> = {
  self:    { emoji: '👤', message: 'Air is fine for normal activities.',    detail: 'Healthy lungs handle this easily — no restrictions.' },
  kid:     { emoji: '👶', message: 'Outdoor play is fine today.',            detail: 'No restrictions for healthy kids at this level.' },
  elderly: { emoji: '👴', message: 'Regular walks are fine today.',          detail: 'Minimal strain on the heart and lungs.' },
  runner:  { emoji: '🏃', message: 'Good conditions for your run.',          detail: 'No impact on breathing or performance today.' },
  asthma:  { emoji: '🫁', message: 'Manageable air — carry your inhaler.',   detail: 'Mild haze can irritate sensitive airways.' },
};

const UNHEALTHY_SENSITIVE: Record<ProfileType, Rule> = {
  self:    { emoji: '👤', message: 'Limit strenuous outdoor activity.',     detail: 'Lungs tire faster — you may feel it on exertion.' },
  kid:     { emoji: '👶', message: 'Limit outdoor play to 30 mins.',        detail: 'Small lungs absorb more pollution per breath.' },
  elderly: { emoji: '👴', message: 'Short walks OK — skip main roads.',     detail: 'Side streets have noticeably cleaner air.' },
  runner:  { emoji: '🏃', message: 'Run before 8am or after 7pm.',          detail: 'Pollution peaks midday — twice the dose.' },
  asthma:  { emoji: '🫁', message: 'Reduce outdoor time today.',            detail: 'Fine particles can narrow airways within hours.' },
};

const UNHEALTHY: Record<ProfileType, Rule> = {
  self:    { emoji: '👤', message: 'Wear a mask if going outside.',         detail: 'Like smoking 2 cigarettes per hour outdoors.' },
  kid:     { emoji: '👶', message: 'Skip outdoor time today.',              detail: 'Repeated exposure at this level stunts lung growth.' },
  elderly: { emoji: '👴', message: 'Stay indoors — close all windows.',    detail: 'Heart and lungs under significant extra strain.' },
  runner:  { emoji: '🏃', message: 'Move your workout indoors today.',     detail: 'Outdoor run now = 5 cigarettes of smoke.' },
  asthma:  { emoji: '🫁', message: 'Stay inside — high trigger risk.',     detail: 'Haze at this level tightens airways within minutes.' },
};

const PROFILE_LABELS: Record<ProfileType, string> = {
  self: 'You', kid: 'Kids', elderly: 'Elderly', runner: 'Runner', asthma: 'Asthma',
};

export function getHardcodedGuidance(aqi: number, profiles: UserProfile[]): GuidanceCard[] {
  if (aqi <= 50) {
    return [{ emoji: GOOD_ALL.emoji, profileLabel: 'Everyone', message: GOOD_ALL.message, detail: GOOD_ALL.detail, profileType: 'all' }];
  }
  if (aqi > 200) {
    return [{ emoji: HAZARDOUS_ALL.emoji, profileLabel: 'Everyone', message: HAZARDOUS_ALL.message, detail: HAZARDOUS_ALL.detail, profileType: 'all' }];
  }

  const bucket: Record<ProfileType, Rule> =
    aqi <= 100 ? MODERATE : aqi <= 150 ? UNHEALTHY_SENSITIVE : UNHEALTHY;

  const seen = new Set<ProfileType>();
  const cards: GuidanceCard[] = [];
  for (const profile of profiles) {
    if (seen.has(profile.type)) continue;
    seen.add(profile.type);
    const rule = bucket[profile.type];
    cards.push({ emoji: rule.emoji, profileLabel: PROFILE_LABELS[profile.type], message: rule.message, detail: rule.detail, profileType: profile.type });
  }
  return cards;
}
