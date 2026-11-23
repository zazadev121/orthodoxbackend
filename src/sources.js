// Owner-requested Sorani spelling for AI answers; stored evidence remains unchanged.
export function canonicalAnswerNames(text, language) {
  if(language !== "ckb") return text;
  return text
    .replace(/(^|[^\p{L}\p{N}])(عیسا|عیسی|عيسا|عيسى)(?=$|[^\p{L}\p{N}]|(?:ی|دا|وە|ەوە|و|ش)(?:$|[^\p{L}\p{N}]))/gu, (_,prefix)=>prefix+"یەشوا")
    .replace(/\b(archbishops|archbishop|patriarchs|patriarch|priests|priest|saints|saint|monks|monk|begotten|proceeds|churches|church)\b/gi, word => ({
      archbishops: "سەرۆکقەشەکان", archbishop: "سەرۆکقەشە", patriarchs: "پارتریاکەکان", patriarch: "پارتریاک",
      priests: "قەشەکان", priest: "قەشە", saints: "پایەپیرۆزان", saint: "پایەپیرۆز",
      monks: "تاکمەندەکان", monk: "تاکمەند", begotten: "تاکخراو", proceeds: "دەردەچێت",
      churches: "کڵێساکان", church: "کڵێسا",
    })[word.toLowerCase()] || word)
    .replace(/سەرئەسقوف|پاتریارک|پەتریارک|ڕاهیب|کلیسا|کلیسە/g, word => ({
      "سەرئەسقوف": "سەرۆکقەشە", "پاتریارک": "پارتریاک", "پەتریارک": "پارتریاک",
      "ڕاهیب": "تاکمەند", "کلیسا": "کڵێسا", "کلیسە": "کڵێسا",
    })[word]);
}
// Editorial summaries, not quotations or Kurdish Bible translations.
export const approvedHosts = [
  "oca.org",
  "goarch.org",
  "ec-patr.org",
  "antiochian.org",
];
export const localizedPassages = {
  tradition: {
    ckb: "نەریتی پیرۆز ئەو ژیان و باوەڕەیە کە لە کڵێسادا نەوە بە نەوە گوازراوەتەوە. کتێبی پیرۆز لەناو ئەم نەریتەدا شوێنێکی سەرەکی هەیە. دەبێت دابونەریتی کاتیی مرۆڤەکان لە باوەڕی نێردراوان، کە بەردەوامە، جیا بکرێتەوە.",
    kmr: "Kevneşopiya Pîroz ew jiyan û bawerî ye ku di Dêrê de ji nifşekî derbasî nifşekî din bûye. Pirtûka Pîroz di vê kevneşopiyê de cihê sereke digire. Divê adetên demkî yên mirovan ji baweriya mayînde ya şandiyan werin veqetandin.",
  },
  scripture: {
    ckb: "لە باوەڕی ئۆرتۆدۆکسدا، کتێبی پیرۆز سەرەکیترین شایەتیی نووسراوی فێرکردنی خوداییە. کڵێسا وەک نووسراوێکی بە ئیلهامی ڕۆحی پیرۆز وەریدەگرێت و کتێبەکانی لە پەیوەندی بە یەشوای مەسیحەوە دەخوێنێتەوە.",
    kmr: "Di baweriya Ortodoks de, Pirtûka Pîroz şahidiya nivîskî ya sereke ya hînkirina Îlahî ye. Dêr wê wek nivîseke bi îlhama Ruhê Pîroz dipejirîne û pirtûkên wê di têkiliya bi Îsa Mesîh de dixwîne.",
  },
  interpretation: {
    ckb: "تێگەیشتنی ئۆرتۆدۆکس لە کتێبی پیرۆز لە چوارچێوەی نەریتی زیندوو و کۆمەڵی خواپەرستی کڵێسادایە. ڕۆحی پیرۆز ڕێنماییی ئەم تێگەیشتنە دەکات لە شایەتیی کتێبی پیرۆز دەربارەی مەسیح.",
    kmr: "Şîrovekirina Ortodoks a Pirtûka Pîroz di çarçoveya kevneşopiya zindî û civaka perestkar a Dêrê de ye. Ruhê Pîroz rêberiya vê fêmkirina şahidiya Pirtûka Pîroz ya li ser Mesîh dike.",
  },
  faith: {
    ckb: "باوەڕی مەسیحی متمانە بە خودا و پابەندبوون بەوە. دانپێدانانی باوەڕ، باوەڕی کەسی لەناو کڵێسادا دەردەبڕێت. باوەڕ لە هیوا، خۆشەویستی و ژیانێک کە ڕۆحی پیرۆز شێوەی پێ دەدات جیا نابێتەوە.",
    kmr: "Baweriya Xiristiyanî bawerî û girêdayîbûn bi Xwedê ye. Daxuyaniya baweriyê, îtirafa kesane ya baweriyê di nav Dêrê de nîşan dide. Bawerî ji hêvî, evîn û jiyaneke ku Ruhê Pîroz şêwazê dide wê nayê veqetandin.",
  },
};
export function decodeSource(source) {
  try {
    const parsed = JSON.parse(source.content);
    if (parsed && typeof parsed.en === "string")
      return {
        ...source,
        content: parsed.en,
        content_ckb: typeof parsed.ckb === "string" ? parsed.ckb : "",
        content_kmr: typeof parsed.kmr === "string" ? parsed.kmr : "",
      };
  } catch {}
  return source;
}
export function encodeSource(source) {
  const { content_ckb, content_kmr, ...row } = source;
  if (content_ckb && content_kmr)
    row.content = JSON.stringify({
      en: source.content,
      ckb: content_ckb,
      kmr: content_kmr,
    });
  return row;
}

export function selectedAnswer(selection, sources, language) {
  const passage = (source) =>
    language === "en" ? source.content : source[`content_${language}`];
  if (
    !selection ||
    !Array.isArray(selection.sourceIds) ||
    !selection.sourceIds.length ||
    selection.sourceIds.length > 4
  )
    return null;
  const ids = [...new Set(selection.sourceIds)];
  if (
    !ids.every((id) =>
      sources.some(
        (s) =>
          s.id === id && typeof passage(s) === "string" && passage(s).trim(),
      ),
    )
  )
    return null;
  // Generated prose never reaches the visitor; return only approved passages.
  const answer = canonicalAnswerNames(ids
    .map((id) =>
      passage(sources.find((s) => s.id === id))
        .trim()
        .split(/\n\s*\n/)
        .map((p) => `${p} [${id}]`)
        .join("\n\n"),
    )
    .join("\n\n"), language);
  const validated = validateAnswer(
    { answer, citationIds: ids },
    sources,
    language,
  );
  return validated ? { ...validated, citations: validated.citations.map(c => { const source = sources.find(s => s.id === c.id); return language === "ka" ? {...c,title:source.title_ka || "პირველწყარო",publisher:source.publisher_ka || "მართლმადიდებლური გამოცემა"} : c; }), mode: "approved-passages" } : null;
}
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
      "bible scripture jesus christ کتێبی پیرۆز یەشوا مەسیح Îsa Mesîh Incîl",
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
for (const source of starterSources) {
  source.content_ckb = localizedPassages[source.id].ckb;
  source.content_kmr = localizedPassages[source.id].kmr;
}
const normalize = (s) =>
  s.toLowerCase().normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
export function retrieve(question, sources) {
  const words = [
    ...new Set(normalize(canonicalAnswerNames(question, "ckb")).match(/[\p{L}\p{N}]{3,}/gu) || []),
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
          (normalize(canonicalAnswerNames(`${s.title} ${s.content} ${s.title_ka || ""} ${s.content_ka || ""} ${s.keywords}`, "ckb")).includes(w) ||
            (
              normalize(canonicalAnswerNames(s.keywords || "", "ckb")).match(/[\p{L}\p{N}]{3,}/gu) || []
            ).some((k) => w.startsWith(k))),
      ).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
export const refusal = {
  ka: "დამტკიცებულ წყაროებში ამ კითხვაზე პასუხის გასაცემად საკმარისი ინფორმაცია ვერ მოიძებნა. დააზუსტეთ შეკითხვა ან მიმართეთ მართლმადიდებელ მღვდელს.",
  en: "I could not find enough information in the approved sources to answer this question. Please make your question more specific or speak with an Orthodox priest.",
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
  if (language === "ka" && !/[\u10a0-\u10ff\u1c90-\u1cbf]/.test(raw.answer)) return null;
  if (language === "ckb" && !/[\u0600-\u06ff]/.test(raw.answer)) return null;
  if (language !== "ckb" && /[\u0600-\u06ff]/.test(raw.answer)) return null;
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
