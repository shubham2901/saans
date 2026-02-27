import axios from 'axios';
import { UserProfile, GuidanceCard, HourlyForecast } from '../types';
import { getHardcodedGuidance } from '../constants/thresholds';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from './storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const LAST_CLAUDE_CALL_KEY = 'last_claude_api_call_timestamp';

// Cooldown period: 2 hours (in milliseconds)
const CLAUDE_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export interface GuidanceParams {
  aqi: number;
  status: string;
  dominantPollutant: string;
  pm25: number;
  city: string;
  profiles: UserProfile[];
  hourlyForecast: HourlyForecast[];
  bestWindowHour: number | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
}

export const claudeService = {
  async generateDailyGuidance(params: GuidanceParams): Promise<GuidanceCard[]> {
    const { aqi, profiles } = params;
    
    // Sort and join profile types for cache key
    const profilesHash = profiles.map(p => p.type).sort().join('_');
    const date = new Date().toISOString().slice(0, 10);
    // Round AQI to nearest 10 to increase local cache hits
    const roundedAqi = Math.round(aqi / 10) * 10;
    
    const cacheKey = `guidance_${date}_${roundedAqi}_${profilesHash}`;

    // 1. Check local TTL cache
    const cachedGuidance = await getCache<GuidanceCard[]>(cacheKey);
    if (cachedGuidance) {
      return cachedGuidance;
    }

    // 2. Check rate limiting (has it been called in the last 2 hours?)
    try {
      const lastCallTimeStr = await AsyncStorage.getItem(LAST_CLAUDE_CALL_KEY);
      if (lastCallTimeStr) {
        const lastCallTime = parseInt(lastCallTimeStr, 10);
        if (Date.now() - lastCallTime < CLAUDE_COOLDOWN_MS) {
          // Cooldown active, fallback to hardcoded
          console.log('Claude API cooldown active, using hardcoded guidance.');
          return getHardcodedGuidance(aqi, profiles);
        }
      }
    } catch {
      // Ignore async storage errors for rate limiting check
    }

    // 3. Prevent API calls if key is missing
    if (!ANTHROPIC_API_KEY) {
       console.log('Missing Anthropic API Key, using hardcoded guidance.');
       return getHardcodedGuidance(aqi, profiles);
    }

    // 4. API Call to Anthropic
    try {
      const systemPrompt = `You are a health-focused air quality advisor for India. 
Generate brief daily guidance cards based on AQI data.
Rules:
- Be direct. Never say 'consider', 'may want to', 'might'.
- This is NOT medical advice. Say 'recommended' not 'safe/unsafe'.
- Keep each message under 12 words.
- Detail field: one sentence explaining why.
- Return ONLY a JSON array. No markdown. No explanation.
- Never say 'I' or refer to yourself.`;

      const userPrompt = `City: ${params.city}
Current AQI: ${params.aqi} (${params.status})
Main pollutant: ${params.dominantPollutant}
PM2.5: ${params.pm25}
Time: ${params.timeOfDay}
Best outdoor window today: ${params.bestWindowHour ? params.bestWindowHour + 'pm' : 'no clear window'}
User profiles: ${profiles.map(p => p.type).join(', ')}

Generate one guidance card per profile plus one for everyone.
Max 5 cards. JSON format:
[{
  "emoji": "emoji string",
  "profileLabel": "profile name or Everyone",
  "message": "message string",
  "detail": "detail string",
  "profileType": "string (profile type or 'everyone')"
}]`;

      // timeout is 5 seconds
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307', // Using haiku-3 for standard available model
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 5000, 
        }
      );

      const content = response.data?.content?.[0]?.text;
      
      if (!content) {
         throw new Error('Empty response from Claude');
      }

      // remove possible markdown formatting
      const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsed: GuidanceCard[] = JSON.parse(cleanContent);
      
      if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('Invalid JSON format or empty array returned');
      }

      // 5. Update cache and rate limiting timestamp
      await setCache(cacheKey, parsed, 120); // 120 minutes TTL
      await AsyncStorage.setItem(LAST_CLAUDE_CALL_KEY, Date.now().toString());

      return parsed;

    } catch (e) {
      console.log('Error calling Claude API:', e);
      // Fast fallback to hardcoded rules
      return getHardcodedGuidance(aqi, profiles);
    }
  }
};
