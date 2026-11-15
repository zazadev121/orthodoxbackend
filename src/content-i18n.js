// Store optional English translations in the existing text column. The tagged
// envelope is decoded at the API boundary; existing plain Kurdish rows still work.
export function encodeContent(row, limit = 12000) {
  const { text_en, title_en, topic_en, ...stored } = row;
  if (text_en || title_en)
    stored.text_kmr = JSON.stringify({
      format: "orthodoxy-content-v1",
      kmr: row.text_kmr,
      en: text_en || "",
      title_en: title_en || "",
    });
  if (stored.text_kmr.length > limit) {
    const error = new Error(
      "The combined Kurmanji and English translations are too long. Shorten them before saving.",
    );
    error.code = "TRANSLATIONS_TOO_LONG";
    throw error;
  }
  return stored;
}
export function decodeContent(row) {
  try {
    const value = JSON.parse(row.text_kmr);
    if (
      value.format === "orthodoxy-content-v1" &&
      typeof value.kmr === "string"
    )
      return {
        ...row,
        text_kmr: value.kmr,
        text_en: typeof value.en === "string" ? value.en : "",
        title_en: typeof value.title_en === "string" ? value.title_en : "",
      };
  } catch {}
  return row;
}
