import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { Flow } from '../App';
import { AppTab } from '../src/components/BottomNav';
import '../src/assets/fonts/web-fonts.css';
import homeHero from '../src/assets/images/home-hero.jpg';
import onboardingWarrior from '../src/assets/images/onboarding-warrior.jpg';
import calibrationStanding from '../src/assets/images/calibration-standing.jpg';
import pocketTrainerMark from '../src/assets/images/pockettrainer-mark.png';

(
  globalThis as typeof globalThis & {
    require: (path: string) => { uri: string };
  }
).require = (path: string) => ({
  uri: String(
    path.includes('calibration-standing')
      ? calibrationStanding
      : path.includes('pockettrainer-mark')
      ? pocketTrainerMark
      : path.includes('onboarding-warrior')
      ? onboardingWarrior
      : homeHero,
  ),
});

const params = new URLSearchParams(window.location.search);
const flow = (params.get('flow') as Flow) || 'welcome';
const tab = (params.get('tab') as AppTab) || 'home';
createRoot(document.getElementById('root')!).render(
  <App initialFlow={flow} initialTab={tab} />,
);
