// 質問と、その答えが何を決めるか。
// ここを増やすときは、対応する templates/stack/<key>/STACK.md も足す。

export const APP_TYPES = {
  desktop: { label: 'デスクトップ' },
  mobile:  { label: 'モバイル' },
  web:     { label: 'ウェブ' },
  cli:     { label: 'CLI' },
};

// key: templates/stack/<key>/ に対応
export const STACKS = {
  'tauri': {
    label: 'Tauri（Rust + Web フロント）',
    for: ['desktop'],
    scaffold: 'npm create tauri-app@latest .',
  },
  'electron': {
    label: 'Electron（electron-vite）',
    for: ['desktop'],
    scaffold: 'npm create @quick-start/electron@latest .',
  },
  'capacitor': {
    label: 'Capacitor（Web UI を iOS / Android に載せる）',
    for: ['mobile'],
    scaffold: 'npm create vite@latest . && npm i @capacitor/core @capacitor/cli && npx cap init',
  },
  'react-native': {
    label: 'React Native（Expo）',
    for: ['mobile'],
    scaffold: 'npx create-expo-app@latest .',
  },
  'next-vercel-supabase': {
    label: 'Next.js + Vercel + Supabase',
    for: ['web'],
    scaffold: 'npx create-next-app@latest .',
  },
  'laravel-react-vite': {
    label: 'Laravel + React + Vite（Inertia）',
    for: ['web'],
    scaffold: 'composer create-project laravel/laravel . && composer require inertiajs/inertia-laravel',
  },
  'node-cli': {
    label: 'Node.js CLI',
    for: ['cli'],
    scaffold: 'npm init -y',
  },
};

export const CI = {
  github: { label: 'GitHub Actions' },
  none:   { label: '無し（あとで決める）' },
};

export const HOSTING = {
  firebase:   { label: 'Firebase Hosting', for: ['web'] },
  vercel:     { label: 'Vercel', for: ['web'] },
  cloudflare: { label: 'Cloudflare Pages / Workers', for: ['web'] },
  ec2:        { label: 'AWS EC2', for: ['web'] },
  ftp:        { label: '共用レンタルサーバー（FTP / SFTP）', for: ['web'] },
  none:       { label: '無し／該当しない', for: ['desktop', 'mobile', 'web', 'cli'] },
};
