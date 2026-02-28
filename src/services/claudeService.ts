import axios from 'axios';
import { UserProfile, GuidanceCard, HourlyForecast } from '../types';
import { getHardcodedGuidance } from '../constants/thresholds';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from './storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const LAST_AI_CALL_KEY = 'last_ai_api_call_timestamp';

// Cooldown period: 2 hours (in milliseconds)
const AI_COOLDOWN_MS = 2 * 60 * 60 * 1000;

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
  async generateDailyGuidance(params: GuidanceParams, bust = false): Promise<GuidanceCard[]> {
    const { aqi, profiles } = params;

    // Sort and join profile types and NAMES for more unique cache key
    const profilesHash = profiles
      .map(p => `${p.type}_${p.name}`)
      .sort()
      .join('|');

    const date = new Date().toISOString().slice(0, 10);
    // Use narrower AQI buckets (round to nearest 3) to be more sensitive to small changes.
    const roundedAqi = Math.round(aqi / 3) * 3;

    const cacheKey = `guidance_v3_${date}_${roundedAqi}_${profilesHash}`;

    // 1. Check local TTL cache
    if (!bust) {
      const cachedGuidance = await getCache<GuidanceCard[]>(cacheKey);
      if (cachedGuidance) {
        console.log('AI Guidance: Cache Hit for key', cacheKey);
        return cachedGuidance;
      }
    }
    console.log(`AI Guidance: ${bust ? 'Bust' : 'Miss'}. Fetching fresh guidance...`);

    // 2. Rate limiting check removed (relying on getCache TTL for efficiency)
    // Local cache already ensures we don't call the API for the same AQI/Profile within 120 minutes.

    // 3. Prevent API calls if key is missing
    if (!GEMINI_API_KEY) {
      console.log('Missing Gemini API Key, using hardcoded guidance.');
      return getHardcodedGuidance(aqi, profiles);
    }

    // 4. API Call to Gemini
    try {
      const systemPrompt = `You are a health-focused air quality advisor for India.
Generate ultra-brief guidance cards based on AQI data.
Rules:
- Be direct. Never say 'consider', 'may want to', 'might'.
- This is NOT medical advice. Say 'recommended' not 'safe/unsafe'.
- No Jargon: Do NOT say "AQI", "PM2.5", "PM10". Use "smoke", "dust", "haze".
- No Redundant Labels: Do NOT start with "Kids:", "Everyone:", etc.
- Standard Emojis: 👤 (self), 👶 (kid), 👴 (elderly), 🏃 (runner), 🫁 (asthma), 🌍 (everyone).
- message field: MAX 8 words. One sharp action or verdict. Examples:
  * "Use masks for kids to avoid long term effects."
  * "Great morning for your run."
  * "Skip the park — air is bad."
- detail field: 15–25 words. One specific health repercussion — either short-term (what happens today) or long-term (what repeated exposure causes). Be concrete and human, not vague. Examples:
  * Short-term: "Fine particles enter your bloodstream within minutes, straining your heart and raising blood pressure."
  * Short-term: "Eyes and throat start burning after 2 hours outside at this level."
  * Long-term: "Children's lungs shrink by X% if they breathe this daily."
  * Long-term: "Months of exposure at this level raises heart attack risk by 20%."
  * Analogy: "Breathing outside today is equivalent to smoking 3 cigarettes over the day."
  * Choose short-term for AQI above 150. Choose long-term or analogy for AQI 50–150.
- Return ONLY a JSON array. No markdown. No explanation.`;

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

      // console.log('Sending Gemini API Payload:', JSON.stringify(payload, null, 2)); // No direct payload to log in this structure

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\n${userPrompt}`
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error('Empty response from Gemini');
      }

      // remove possible markdown formatting (Gemini sometimes adds it even if told not to)
      const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsed: GuidanceCard[] = JSON.parse(cleanContent);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid JSON format or empty array returned');
      }

      // 5. Update cache
      await setCache(cacheKey, parsed, 120); // 120 minutes TTL

      return parsed;

    } catch (e: any) {
      if (e.response) {
        console.log('Gemini API Error Response:', e.response.status, JSON.stringify(e.response.data, null, 2));
      } else {
        console.log('Error calling Gemini API:', e.message || e);
      }
      // Fast fallback to hardcoded rules
      return getHardcodedGuidance(aqi, profiles);
    }
  }
};
