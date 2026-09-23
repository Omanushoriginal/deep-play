// Match results come from openfootball's public-domain Football.TXT archives.
// If a season is missing or the archive is offline, the 65 editorial questions remain playable.
const UCL_SEASONS = Array.from({ length: 14 }, (_, i) => {
  const start = 2012 + i;
  return { url: `https://raw.githubusercontent.com/openfootball/champions-league/master/${start}-${String(start + 1).slice(-2)}/cl.txt`, label: `${start}/${String(start + 1).slice(-2)} UEFA Champions League`, cat: 'CHAMPIONS LEAGUE ARCHIVE', pattern: 'ucl' };
});

const TOURNAMENT_FILES = [
  ...[
    ['2022--qatar', '2022 FIFA World Cup'], ['2018--russia', '2018 FIFA World Cup'],
    ['2014--brazil', '2014 FIFA World Cup'], ['2010--south_africa', '2010 FIFA World Cup'],
    ['2006--germany', '2006 FIFA World Cup'], ['2002--south_korea-n-japan', '2002 FIFA World Cup'],
    ['1998--france', '1998 FIFA World Cup'], ['1994--usa', '1994 FIFA World Cup']
  ].map(([folder, label]) => ({ url: `https://raw.githubusercontent.com/openfootball/worldcup/master/${folder}/cup.txt`, label, cat: 'WORLD CUP ARCHIVE', pattern: 'general' })),
  ...[
    ['2024--germany', '2024 UEFA EURO'], ['2021--europe', '2020 UEFA EURO'],
    ['2016--france', '2016 UEFA EURO'], ['2012--poland-ukraine', '2012 UEFA EURO'],
    ['2008--austria-switzerland', '2008 UEFA EURO'], ['2004--portugal', '2004 UEFA EURO'],
    ['2000--belgium-netherlands', '2000 UEFA EURO'], ['1996--england', '1996 UEFA EURO']
  ].map(([folder, label]) => ({ url: `https://raw.githubusercontent.com/openfootball/euro/master/${folder}/euro.txt`, label, cat: 'EUROPEAN CHAMPIONSHIP ARCHIVE', pattern: 'general' }))
];

function parseMatches(text, source) {
  const result = [];
  let matchDate = '';
  for (const line of text.split(/\r?\n/)) {
    // Football.TXT can list a shootout score before the actual match score.
    // Skip these lines rather than quiz the penalty tally as the match result.
    if (/\bpen\./i.test(line)) continue;
    const date = line.match(/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2}\s+\d{1,2}(?:\s+\d{4})?)/);
    if (date) matchDate = date[1].replace(/\s+/g, ' ');

    let home, away, homeGoals, awayGoals;
    if (source.pattern === 'ucl') {
      const ucl = line.match(/^\s*\d{1,2}:\d{2}\s+(.+?)\s+\([A-Z]{3}\)\s+v\s+(.+?)\s+\([A-Z]{3}\)\s+(\d+)\s*[-–]\s*(\d+)/u);
      if (ucl) [, home, away, homeGoals, awayGoals] = ucl;
    }
    if (!home) {
      const general = line.match(/^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s+(\d+)\s*[-–]\s*(\d+)(?:\s+\(\d+\s*[-–]\s*\d+\))?\s+(.+?)(?:\s+@.*)?\s*$/u);
      if (general) [, home, homeGoals, awayGoals, away] = general;
    }
    if (!home || !away) continue;
    home = home.replace(/\s+/g, ' ').trim(); away = away.replace(/\s+/g, ' ').trim();
    if (!home || !away || home === away) continue;
    const score = `${homeGoals}-${awayGoals}`;
    result.push({
      id: `archive:${source.label}:${matchDate}:${home}:${away}:${score}`,
      cat: source.cat,
      q: `What was the full-time score when ${home} played ${away} in the ${source.label}${matchDate ? ` (${matchDate})` : ''}?`,
      a: [score, `${homeGoals}:${awayGoals}`, `${homeGoals} ${awayGoals}`],
      fact: `The match finished ${homeGoals}–${awayGoals}.`
    });
  }
  return result;
}

export async function loadArchiveQuestions() {
  const sources = [...UCL_SEASONS, ...TOURNAMENT_FILES];
  const responses = await Promise.all(sources.map(async source => {
    try {
      const response = await fetch(source.url, { cache: 'force-cache' });
      if (!response.ok) return [];
      return parseMatches(await response.text(), source);
    } catch { return []; }
  }));
  const seen = new Set();
  return responses.flat().filter(question => {
    if (seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
}
