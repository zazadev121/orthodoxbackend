// Editorial summaries, not quotations or Kurdish Bible translations.
export const approvedHosts = [
  "oca.org",
  "goarch.org",
  "ec-patr.org",
  "antiochian.org",
];
export function approvedUrl(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      approvedHosts.includes(u.hostname.replace(/^www\./, ""))
    );
  } catch {
    return false;
  }
}
export const starterSources = [
  {
    id: "tradition",
    title: "Holy Tradition",
    publisher: "Orthodox Church in America",
    url: "https://www.oca.org/orthodoxy/the-orthodox-faith/doctrine-scripture/sources-of-christian-doctrine/tradition",
    content:
      "Holy Tradition is the life and faith handed down in the Church. Scripture has a primary place within it. Temporary human customs must be distinguished from the enduring apostolic faith.",
    keywords:
      "tradition scripture bible نەریت کتێبی پیرۆز دابونەریت kevneşop pirtûk",
  },
  {
    id: "scripture",
    title: "The Bible in Orthodox faith",
    publisher: "Orthodox Church in America",
    url: "https://www.oca.org/orthodoxy/the-orthodox-faith/doctrine-scripture/sources-of-christian-doctrine/bible1",
    content:
      "The Bible is the principal written witness to divine teaching in Orthodoxy. The Church receives it as inspired by the Holy Spirit and reads its books in relation to Jesus Christ.",
    keywords:
      "bible scripture jesus christ کتێبی پیرۆز عیسا مەسیح Îsa Mesîh Incîl",
  },
  {
    id: "interpretation",
    title: "Interpreting Scripture",
    publisher: "Orthodox Church in America",
    url: "https://www.oca.org/orthodoxy/the-orthodox-faith/doctrine-scripture/the-bible/interpretation",
    content:
      "Orthodox interpretation of Scripture belongs within the living Tradition and worshipping community of the Church. The Holy Spirit guides this understanding of the biblical witness to Christ.",
    keywords:
      "interpret interpretation church spirit لێکدانەوە ڕۆح کڵێسا şîrove dêr ruh",
  },
  {
    id: "faith",
    title: "Faith",
    publisher: "Orthodox Church in America",
    url: "https://www.oca.org/orthodoxy/the-orthodox-faith/doctrine-scripture/the-symbol-of-faith/faith",
    content:
      "Christian faith is trust in God and commitment to him. The Creed expresses personal confession within the Church. Faith is inseparable from hope, love, and a life shaped by the Holy Spirit.",
    keywords:
      "faith creed belief love hope باوەڕ خۆشەویستی هیوا bawerî evîn hêvî",
  },
];
const normalize = (s) =>
  s.toLowerCase().normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
export function retrieve(question, sources) {
  const words = [
    ...new Set(normalize(question).match(/[\p{L}\p{N}]{3,}/gu) || []),
  ];
  const stop = new Set([
    "what",
    "the",
    "about",
    "چۆن",
    "چییە",
    "چیە",
    "چیه",
    "بۆچی",
    "چۆنه",
    "orthodox",
    "orthodoxy",
    "ئۆرتۆدۆکس",
    "ye",
    "çi",
    "çawa",
  ]);
  return sources
    .filter((s) => approvedUrl(s.url))
    .map((s) => ({
      ...s,
      score: words.filter(
        (w) =>
          !stop.has(w) &&
          normalize(`${s.title} ${s.content} ${s.keywords}`).includes(w),
      ).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
export const refusal = {
  ckb: "لە سەرچاوە پەسەندکراوەکاندا زانیاریی پێویستم بۆ وەڵامی ئەم پرسیارە نەدۆزییەوە. تکایە پرسیارەکەت وردتر بکەوە یان لە قەشەیەکی ئۆرتۆدۆکس بپرسە.",
  kmr: "Di çavkaniyên pejirandî de agahiya têr ji bo bersiva vê pirsê nehat dîtin. Ji kerema xwe pirsê zelaltir bike an ji kahînekî Ortodoks bipirse.",
};
export function validateAnswer(raw, sources, language) {
  if (
    !raw ||
    typeof raw.answer !== "string" ||
    raw.answer.length > 8000 ||
    !Array.isArray(raw.citationIds) ||
    !raw.citationIds.length
  )
    return null;
  const ids = [...new Set(raw.citationIds)];
  if (!ids.every((id) => sources.some((s) => s.id === id))) return null;
  const markers = [...raw.answer.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  if (
    !ids.every((id) => markers.includes(id)) ||
    !markers.every((id) => ids.includes(id))
  )
    return null;
  if (
    raw.answer
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .some((p) => !ids.some((id) => p.includes(`[${id}]`)))
  )
    return null;
  if (language === "ckb" && !/[\u0600-\u06ff]/.test(raw.answer)) return null;
  if (language === "kmr" && /[\u0600-\u06ff]/.test(raw.answer)) return null;
  // Links are supplied by the server, never by generated prose.
  if (/https?:\/\/|www\./i.test(raw.answer)) return null;
  return {
    answer: raw.answer,
    citations: sources
      .filter((s) => ids.includes(s.id))
      .map(({ id, title, publisher, url }) => ({ id, title, publisher, url })),
    grounded: true,
  };
}
