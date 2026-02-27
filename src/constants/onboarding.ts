import { UserProfile } from '../types';

export interface ProfileOption {
  type: UserProfile['type'];
  emoji: string;
  label: string;
  subOptions: { id: string; label: string }[] | null;
}

export interface TimeSlotOption {
  id: string;
  label: string;
  time: string;
}

export const PROFILE_OPTIONS: ProfileOption[] = [
  {
    type: 'self',
    emoji: '🧑',
    label: 'Yourself',
    subOptions: null,
  },
  {
    type: 'kid',
    emoji: '👦',
    label: 'Kids',
    subOptions: [
      { id: 'morning', label: 'Morning school' },
      { id: 'afternoon', label: 'Afternoon school' },
    ],
  },
  {
    type: 'elderly',
    emoji: '👴',
    label: 'Elderly Parent',
    subOptions: null,
  },
  {
    type: 'runner',
    emoji: '🏃',
    label: 'Runner',
    subOptions: [
      { id: 'morning', label: 'Morning run' },
      { id: 'evening', label: 'Evening run' },
    ],
  },
  {
    type: 'asthma',
    emoji: '🫁',
    label: 'Asthma/Respiratory',
    subOptions: null,
  },
];

export const TIME_SLOTS: TimeSlotOption[] = [
  { id: 'morning',      label: 'Morning',      time: '6–9am'  },
  { id: 'school_drop',  label: 'School drop',  time: '7–9am'  },
  { id: 'work_commute', label: 'Work commute', time: '9–10am' },
  { id: 'lunch',        label: 'Lunch break',  time: ''       },
  { id: 'evening',      label: 'Evening',      time: '5–8pm'  },
  { id: 'late_evening', label: 'Late evening', time: '8pm+'   },
];
