export interface PresetGoal {
  label: string;
  goal: string;
}

export const PRESET_GOALS: PresetGoal[] = [
  {
    label: 'Give me a complete understanding of this workspace',
    goal: 'Give me a complete understanding of this workspace',
  },
  {
    label: 'What should I look at first?',
    goal: 'What should I look at first?',
  },
  {
    label: 'Is this workspace ready?',
    goal: 'Is this workspace ready?',
  },
  {
    label: 'Which files are most important?',
    goal: 'Which files are most important?',
  },
  {
    label: 'Generate a workspace report',
    goal: 'Generate a workspace report',
  },
];
