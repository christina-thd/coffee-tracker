import { $ } from '../shared/dom.js';

// Short enough to share the row with the Beans filter on a phone.
const ANYTIME = ['Bean there, brewing that', 'Ready for a cup?', 'Time for a refill', 'Brew o\'clock',
  'Keep calm and pour on', 'You mocha me happy', 'Sip happens'];
const AFTER_A_BREW = ['Another one, why not'];      // only once something was logged today

const GREETINGS = {
  night: ['Late-night coffee?', 'Sleep is overrated', 'One more, then bed', 'Night shift brew?', 'Owls need coffee too',
    'Mid-night roast?', 'Bean up all night?', 'Still up? Same'],
  morning: ['Rise and grind', 'First sip, then life', 'Morning, coffee person', 'Coffee first, then words',
    'Brew-tiful morning', 'Sun\'s up, cups up'],
  afternoon: ['Afternoon cup?', 'Coffee break?'],
  evening: ['A little evening brew?', 'Too late for coffee? Nah', 'One for the road', 'One last cup?',
    'A cup to end the day', 'Bean a long day?'],
};

const partOf = (hour) => (hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');

// One pick per part of the day: a new line on the next visit, no change on the minute re-render.
let shown = { part: null, text: '' };

/** @param {import('../shared/coffee.js').Brew[]} brews */
function greeting(brews, now = new Date()) {
  const part = partOf(now.getHours());
  if (shown.part !== part) {
    const today = now.toDateString();
    const brewedToday = brews.some((b) => new Date(b.brewedAt).toDateString() === today);
    const options = [...GREETINGS[part], ...ANYTIME, ...(brewedToday ? AFTER_A_BREW : [])]
      .filter((g) => g !== shown.text);
    shown = { part, text: options[Math.floor(Math.random() * options.length)] };
  }
  return shown.text;
}

/** @param {import('../shared/coffee.js').Brew[]} brews */
export function renderHero(brews) {
  $('greeting').textContent = greeting(brews);
}
