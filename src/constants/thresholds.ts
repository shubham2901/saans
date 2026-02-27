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
  message: 'Great air! Safe for all outdoor activities.',
  detail: 'AQI is in the Good range (0–50). Everyone can enjoy outdoor time freely — running, cycling, park visits, school play. No precautions needed for any group today.',
};

const HAZARDOUS_ALL: Rule = {
  emoji: '🚨',
  message: 'Hazardous air. Stay indoors. Close all windows. Run air purifier if available.',
  detail: 'AQI has reached a critical level. Do not go outside. Keep all windows and doors closed. Run an air purifier on maximum. Postpone all non-essential travel. Children, elderly, and anyone with respiratory conditions must stay inside.',
};

const MODERATE: Record<ProfileType, Rule> = {
  self: { emoji: '👤', message: 'Air is decent. Normal activities OK.', detail: 'AQI is Moderate (51–100). Some pollutants present but nothing alarming for healthy adults. Go about normal activities with no special precautions.' },
  kid: { emoji: '👦', message: 'Outdoor play is fine. No restrictions today.', detail: 'Moderate air is generally safe for children. Normal school recess, outdoor sports, and park play are all OK today.' },
  elderly: { emoji: '👴', message: 'Normal outdoor activity is fine.', detail: 'Moderate AQI poses minimal risk for most older adults. Regular walks are fine. Limit strenuous exercise if you have heart or lung conditions.' },
  runner: { emoji: '🏃', message: 'Good day to run. All times work.', detail: 'Moderate air quality is suitable for running at any time. No significant impact on performance. Stay hydrated as always.' },
  asthma: { emoji: '🫁', message: 'Air is moderate. Carry inhaler as precaution.', detail: 'AQI is Moderate — manageable for most asthma patients, but keep your rescue inhaler on hand. Shorten outdoor time if you feel uncomfortable.' },
};

const UNHEALTHY_SENSITIVE: Record<ProfileType, Rule> = {
  self: { emoji: '👤', message: 'Sensitive individuals should limit outdoor time.', detail: 'At this level, people with respiratory or heart conditions may be affected. Healthy adults can go out but limit strenuous activity. Consider a mask near heavy traffic.' },
  kid: { emoji: '👦', message: 'Limit outdoor play to 30 mins. Avoid noon.', detail: "Pollution peaks at midday. Keep outdoor activity under 30 minutes — preferably morning or after 5pm. Watch for coughing or eye irritation." },
  elderly: { emoji: '👴', message: 'Short walks OK. Avoid main roads.', detail: 'Side streets and parks have significantly cleaner air than main roads. Keep walks under 20 minutes. Those with COPD or heart disease should consider staying indoors.' },
  runner: { emoji: '🏃', message: 'Run before 8am or after 7pm today.', detail: 'Pollutant levels are highest from 10am–6pm. Early morning or late evening runs expose you to far less pollution. Reduce intensity if you feel any breathing discomfort.' },
  asthma: { emoji: '🫁', message: 'Reduce outdoor time. Keep inhaler ready.', detail: 'At this AQI, PM2.5 particles can irritate airways. Limit outdoor exposure to under 15 minutes and keep your reliever inhaler accessible at all times.' },
};

const UNHEALTHY: Record<ProfileType, Rule> = {
  self: { emoji: '👤', message: 'Limit outdoor exposure. Wear mask if going out.', detail: "AQI is Unhealthy for everyone. Limit outdoor time to essential trips. Wear an N95 or KN95 mask for any outdoor exposure. Avoid outdoor exercise." },
  kid: { emoji: '👦', message: 'Skip outdoor play today. Keep windows closed.', detail: "Children's lungs are especially vulnerable at this level. Cancel outdoor activities. Use N95 masks for the school commute. Keep bedroom windows closed." },
  elderly: { emoji: '👴', message: 'Stay indoors. Brief outings only if necessary.', detail: 'Unhealthy air poses serious risk for older adults with heart or lung conditions. Keep windows closed. Use AC in recirculation mode if available.' },
  runner: { emoji: '🏃', message: 'Postpone outdoor run. Try indoors.', detail: 'Running outdoors in Unhealthy AQI dramatically increases pollution intake. Move your workout inside — treadmill, cycling, or yoga. Resume when AQI drops below 150.' },
  asthma: { emoji: '🫁', message: 'Stay indoors. PM2.5 can trigger symptoms.', detail: 'PM2.5 at this level is a known asthma trigger. Staying indoors with windows closed is strongly recommended. If you must go out, wear an N95 mask.' },
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
