// Site working translations of traditional prayers/excerpts, checked against the
// linked Orthodox publications. They are not official Kurdish liturgical texts.
const prayer = (number, fields) => ({
  id: `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  published: true,
  ...fields,
});
export const starterPrayers = [
  prayer(1, {
    title_ckb: "نوێژی بەیانی — دەستپێک",
    title_kmr: "Duaya sibehê — destpêk",
    topic: "بەیانی / Sibeh",
    text_ckb:
      "ئەی پەسەندکراو، دوای هەستانمان لە خەو، لەبەردەمتدا کڕنووش دەبەین؛ ئەی بەهێز، سروودی فریشتەکانت بۆ دەڵێین: پیرۆز، پیرۆز، پیرۆزیت تۆ، ئەی خودا. بە پاڕانەوەکانی دایکی خودا، بەزەییت پێماندا بێتەوە.",
    text_kmr:
      "Ey Yê Pîroz, piştî ku em ji xewê radibin, em li ber Te serî ditewînin; ey Yê bi hêz, em strana milyaketan ji Te re dibêjin: Pîroz, pîroz, pîroz î Tu, ey Xwedê. Bi lavayên Dayika Xwedê, li me rehmê bike.",
    reference:
      "OCA, Morning Prayers: To the Holy Trinity, opening stanza; site translation",
    source_url: "https://www.oca.org/orthodoxy/prayers/morning-prayers",
  }),
  prayer(2, {
    title_ckb: "نوێژی شەو — بۆ ئارامی پێش خەوتن",
    title_kmr: "Duaya şevê — aramî berî xewê",
    topic: "شەو / Şev",
    text_ckb:
      "ئەی خودای هەتاهەتایی، پاشای هەموو بەدیهێنراوان، کە ڕێگەت دام بگەمە ئەم کاتە، لەو گوناهانەم خۆش ببە کە ئەمڕۆ بە بیر و قسە و کردار کردوومن. ڕێگەم بدە ئەم شەوە بە ئارامی بخەوم. ئامین.",
    text_kmr:
      "Ey Xwedayê herheyî, Padîşahê hemû afirîdên xwe, Tu ku hiştî ez bigihîjim vê saetê, li gunehên min ên îro bi raman, gotin û kirinê kirine bibihûre. Bihêle ez vê şevê di aramiyê de razêm. Amîn.",
    reference:
      "OCA, Evening Prayers: To the Father, opening excerpt; site translation",
    source_url: "https://www.oca.org/orthodoxy/prayers/evening-prayers",
  }),
  prayer(3, {
    title_ckb: "دوعای عیسای مەسیح",
    title_kmr: "Duaya Îsa Mesîh",
    topic: "مەسیح / Mesîh",
    text_ckb:
      "ئەی پەروەردگار عیسای مەسیح، کوڕی خودا، بەزەییت بە منی گوناهباردا بێتەوە.",
    text_kmr: "Ey Xudan Îsa Mesîh, Kurê Xwedê, li min, gunehkar, rehmê bike.",
    reference:
      "OCA, The Orthodox Faith, Volume II: Prayer — Jesus Prayer; site translation",
    source_url:
      "https://www.oca.org/orthodoxy/the-orthodox-faith/worship/the-daily-cycles-of-prayer/prayer",
  }),
  prayer(4, {
    title_ckb: "ئەی مەریەمی پاک، دایکی خودا، دڵشاد بە",
    title_kmr: "Ey Meryema Pîroz, Dayika Xwedê, şa bibe",
    topic: "مەریەم / Meryem",
    text_ckb:
      "ئەی مەریەمی پاک، دایکی خودا، دڵشاد بە! ئەی مەریەم، پڕ لە نیعمەت، پەروەردگار لەگەڵتە. تۆ لەنێو ژناندا پیرۆزکراویت، و بەرهەمی سکت پیرۆزکراوە؛ چونکە تۆ ڕزگارکەری گیانەکانمانت لەدایک کردووە.",
    text_kmr:
      "Ey keçika paqij, Dayika Xwedê, şa bibe! Ey Meryem, tijî kerem, Xudan bi te re ye. Tu di nav jinan de pîroz î û berhema zikê te pîroz e; ji ber ku te Rizgarkerê giyanên me aniye dinyayê.",
    reference:
      "OCA, Evening Prayers: To the Virgin Theotokos, Rejoice; site translation",
    source_url: "https://www.oca.org/orthodoxy/prayers/evening-prayers",
  }),
  prayer(5, {
    title_ckb: "نوێژی باوکمان",
    title_kmr: "Duaya Bavê me",
    topic: "نوێژە سەرەکییەکان / Duayên bingehîn",
    text_ckb:
      "ئەی باوکمان کە لە ئاسمانیت، ناوت پیرۆز بێت. پاشایەتیی تۆ بێت؛ ویستی تۆ وەک لە ئاسمان، لەسەر زەویش بکرێت. نانی ڕۆژانەمان ئەمڕۆ بدەرێ. لە تاوانەکانمان خۆش ببە، وەک ئێمەش لەوانە خۆش دەبین کە تاوانمان بەرامبەر دەکەن. مەمانخەرە ناو تاقیکردنەوە، بەڵکو لە خراپە ڕزگارمان بکە. ئامین.",
    text_kmr:
      "Ey Bavê me yê li ezmanan, bila navê Te pîroz be. Bila padîşahiya Te bê; bila daxwaza Te, wek li ezmanan, li ser erdê jî pêk were. Nanê me yê rojane îro bide me. Li sûcên me bibihûre, wek em jî li yên ku li hember me sûc dikin dibihûrin. Me neke nav ceribandinê, lê me ji xerabiyê rizgar bike. Amîn.",
    reference:
      "GOARCH, Morning Prayers: The Lord’s Prayer; site translation, not a KSS/KURNT quotation",
    source_url: "https://www.goarch.org/-/morning-prayers",
  }),
  prayer(6, {
    title_ckb: "ئەی پاشای ئاسمانی",
    title_kmr: "Ey Padîşahê ezmanî",
    topic: "ڕۆحی پیرۆز / Ruhê Pîroz",
    text_ckb:
      "ئەی پاشای ئاسمانی، دڵنەوایی‌کەر، ڕۆحی ڕاستی، کە لە هەموو شوێنێکیت و هەموو شتێک پڕ دەکەیتەوە، گەنجینەی چاکییەکان و بەخشەری ژیان؛ وەرە و لە ناوماندا نیشتەجێ بە، لە هەموو پیسییەک پاکمان بکەرەوە و گیانەکانمان ڕزگار بکە، ئەی چاک.",
    text_kmr:
      "Ey Padîşahê ezmanî, Dilrehetker, Ruhê Rastiyê, Tu ku li her derê yî û her tiştî tijî dikî, Xezîneya qenciyan û Bexşînerê jiyanê; were û di nav me de bijî, me ji her qirêjiyê paqij bike û giyanên me rizgar bike, ey Yê Qenc.",
    reference:
      "OCA, O Heavenly King and Trisagion Prayers: O Heavenly King; site translation",
    source_url: "https://www.oca.org/orthodoxy/prayers/trisagion",
  }),
  prayer(7, {
    title_ckb: "نوێژی سێ جار پیرۆز",
    title_kmr: "Duaya Sêcar Pîroz",
    topic: "نوێژە سەرەکییەکان / Duayên bingehîn",
    text_ckb:
      "ئەی خودای پیرۆز، ئەی بەهێزی پیرۆز، ئەی نەمرێکی پیرۆز، بەزەییت پێماندا بێتەوە.\n\n(سێ جار دەخوێنرێتەوە.)",
    text_kmr:
      "Ey Xwedayê Pîroz, ey Yê Pîroz û bi Hêz, ey Yê Pîroz û Nemir, li me rehmê bike.\n\n(Sê caran tê xwendin.)",
    reference:
      "OCA, O Heavenly King and Trisagion Prayers: Trisagion; site translation",
    source_url: "https://www.oca.org/orthodoxy/prayers/trisagion",
  }),
  prayer(8, {
    title_ckb: "دوعا پێش خواردن",
    title_kmr: "Dua berî xwarinê",
    topic: "خواردن / Xwarin",
    text_ckb:
      "ئەی مەسیحی خودامان، ئەم خواردن و خواردنەوەی بەندەکانت پیرۆز بکە؛ چونکە تۆ هەتاهەتایە پیرۆزکراویت. ئامین.",
    text_kmr:
      "Ey Mesîh Xwedayê me, vê xwarin û vexwarina xulamên xwe pîroz bike; ji ber ku Tu heta hetayê pîroz î. Amîn.",
    reference:
      "OCA, Blessing Before Meals: concluding blessing; site translation",
    source_url: "https://www.oca.org/questions/dailylife/blessing-before-meals",
  }),
];
