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
  detail: 'Air is clean today. Regular outdoor activity is safe for everyone, including kids and the elderly.',
};

const HAZARDOUS_ALL: Rule = {
  emoji: '🚨',
  message: 'Hazardous air. Stay indoors now.',
  detail: 'Breathing outside right now is like smoking a pack of cigarettes — fine particles enter your bloodstream within minutes.',
};

const MODERATE: Record<ProfileType, Rule> = {
  self:    { emoji: '👤', message: 'Air is fine for normal activities.',   detail: 'At this level, healthy adults show no measurable impact on lung function or cardiovascular strain.' },
  kid:     { emoji: '👶', message: 'Outdoor play is fine today.',           detail: 'Moderate pollution has no short-term impact on healthy children, but limit prolonged exercise on hazy days.' },
  elderly: { emoji: '👴', message: 'Regular walks are fine today.',         detail: 'Mild haze adds marginal stress on the heart — nothing concerning for most, but avoid peak traffic hours.' },
  runner:  { emoji: '🏃', message: 'Good conditions for your run.',         detail: 'No impact on VO2 max or recovery today. Long-term daily exposure at this level can reduce lung capacity over years.' },
  asthma:  { emoji: '🫁', message: 'Manageable air — carry your inhaler.',  detail: 'Fine particles at this level can mildly irritate sensitive airways — a flare-up is unlikely but keep your inhaler close.' },
};

const UNHEALTHY_SENSITIVE: Record<ProfileType, Rule> = {
  self:    { emoji: '👤', message: 'Limit strenuous outdoor activity.',    detail: 'Overexertion at this AQI pulls more particles deep into your lungs, causing fatigue and mild inflammation by evening.' },
  kid:     { emoji: '👶', message: 'Limit outdoor play to 30 mins.',       detail: "Children breathe 50% more air per kg than adults — repeated afternoons like this gradually reduce their lung's growth rate." },
  elderly: { emoji: '👴', message: 'Short walks OK — skip main roads.',    detail: 'Fine particles at this level raise blood pressure and heart rate. Stick to parks and side streets with less traffic exhaust.' },
  runner:  { emoji: '🏃', message: 'Run before 8am or after 7pm.',         detail: 'AQI peaks midday — running then doubles your particle intake. Early morning air is typically 30–40% cleaner.' },
  asthma:  { emoji: '🫁', message: 'Reduce outdoor time today.',           detail: 'Fine particles at this level can inflame airways within 1–2 hours, increasing risk of a flare-up through the evening.' },
};

const UNHEALTHY: Record<ProfileType, Rule> = {
  self:    { emoji: '👤', message: 'Wear a mask if going outside.',        detail: 'Breathing unfiltered air at this AQI is equivalent to smoking 2 cigarettes an hour — fine particles enter your bloodstream directly.' },
  kid:     { emoji: '👶', message: 'Skip outdoor time today.',             detail: 'Prolonged exposure at this level is clinically linked to stunted lung development — lungs grow until age 25 and this window matters.' },
  elderly: { emoji: '👴', message: 'Stay indoors — close all windows.',   detail: 'At this AQI, every hour outside significantly strains heart and lungs. Risk of cardiac events rises measurably above AQI 150.' },
  runner:  { emoji: '🏃', message: 'Move your workout indoors today.',    detail: 'A 45-min run in this air delivers the smoke equivalent of 5 cigarettes. Short-term: burning lungs. Long-term: scarred airways.' },
  asthma:  { emoji: '🫁', message: 'Stay inside — high trigger risk.',    detail: 'Haze at this level constricts airways within 30 minutes of exposure. Keep windows shut and your rescue inhaler nearby.' },
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
