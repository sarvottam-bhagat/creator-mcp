export type UgcStatus = 'queued' | 'generating' | 'completed' | 'failed';

export type UgcVideo = {
  id: string;
  creator_id: string;
  episode_id: string | null;
  title: string;
  hook_script: string;
  presenter: 'female' | 'male';
  duration_seconds: number;
  provider_model: string;
  provider_job_id: string | null;
  status: UgcStatus;
  video_path: string | null;
  failure_reason: string | null;
  created_at: string;
};

export const BEGGAR_HUSBAND_HOOKS = [
  {
    title: 'She married a beggar', presenter: 'female' as const,
    script: 'She married a beggar to prove everyone wrong, but he knew secrets about her family.',
  },
  {
    title: 'Nobody knew his past', presenter: 'male' as const,
    script: 'Everybody warned her not to marry him. Nobody knew he was hiding from his own family.',
  },
  {
    title: 'The hidden letter', presenter: 'female' as const,
    script: 'You will not believe what happens after she finds his hidden letter.',
  },
  {
    title: 'The photograph', presenter: 'male' as const,
    script: 'He had nothing, except one photograph that could destroy her entire family.',
  },
  {
    title: 'The real rescue', presenter: 'female' as const,
    script: 'She thought she was saving him. Turns out, he may be the only one who can save her.',
  },
] as const;
