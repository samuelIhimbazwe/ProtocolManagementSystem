/** Serving-focused scriptures for the login brand panel. */
export const SERVING_SCRIPTURES = [
  {
    text: 'For even the Son of Man did not come to be served, but to serve, and to give his life as a ransom for many.',
    reference: 'Mark 10:45',
  },
  {
    text: 'Each of you should use whatever gift you have received to serve others, as faithful stewards of God’s grace.',
    reference: '1 Peter 4:10',
  },
  {
    text: 'You, my brothers and sisters, were called to be free. But do not use your freedom to indulge the flesh; rather, serve one another humbly in love.',
    reference: 'Galatians 5:13',
  },
  {
    text: 'Whoever wants to become great among you must be your servant, and whoever wants to be first must be slave of all.',
    reference: 'Mark 10:43–44',
  },
  {
    text: 'Just as the Son of Man did not come to be served, but to serve, and to give his life as a ransom for many.',
    reference: 'Matthew 20:28',
  },
  {
    text: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.',
    reference: 'Colossians 3:23',
  },
  {
    text: 'Never be lacking in zeal, but keep your spiritual fervor, serving the Lord.',
    reference: 'Romans 12:11',
  },
  {
    text: 'As for me and my household, we will serve the Lord.',
    reference: 'Joshua 24:15',
  },
  {
    text: 'The greatest among you will be your servant. For those who exalt themselves will be humbled, and those who humble themselves will be exalted.',
    reference: 'Matthew 23:11–12',
  },
  {
    text: 'Now that I, your Lord and Teacher, have washed your feet, you also should wash one another’s feet.',
    reference: 'John 13:14',
  },
  {
    text: 'In everything I did, I showed you that by this kind of hard work we must help the weak, remembering the words of the Lord Jesus: “It is more blessed to give than to receive.”',
    reference: 'Acts 20:35',
  },
  {
    text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.',
    reference: 'Galatians 6:9',
  },
  {
    text: 'And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.',
    reference: 'Colossians 3:17',
  },
  {
    text: 'Be devoted to one another in love. Honor one another above yourselves. Never be lacking in zeal, but keep your spiritual fervor, serving the Lord.',
    reference: 'Romans 12:10–11',
  },
]

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Pick distinct primary / secondary verses for one page load. */
export function pickServingScriptures() {
  const [primary, secondary] = shuffle(SERVING_SCRIPTURES)
  return { primary, secondary }
}
