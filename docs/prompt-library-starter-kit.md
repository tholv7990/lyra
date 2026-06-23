# Lyra prompt library — starter kit (guide + default templates)

> **Status:** Seedable default content for the prompt library. Clean-room authored 2026-06-23.
> **License:** **CC0 1.0** (public domain). These are original prompt texts written from
> non-copyrightable *methods and structures* in the cited best-practice guides — safe to ship,
> copy, and relicense.
> **Two uses:** (1) seed the library / marketplace with high-quality typed defaults; (2) the
> guide below becomes the in-app "How to write a good prompt" helper.

## Why these are trustworthy (the proven basis)

Every principle and formula here is traceable to an authoritative source — not invented:

- **Image** — [Google DeepMind: Nano Banana / Gemini image prompt guide](https://deepmind.google/models/gemini-image/prompt-guide/) · [Gemini API image docs](https://ai.google.dev/gemini-api/docs/image-generation) · [Google Developers blog](https://developers.googleblog.com/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/). *(Gemini is Lyra's image provider — these are the source of truth.)*
- **Video** — [Google DeepMind: Veo prompt guide](https://deepmind.google/models/veo/prompt-guide/) · [Google Cloud: Ultimate Veo 3.1 prompting guide](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1).
- **UGC ad structure** — [TikTok official creative best practices](https://ads.tiktok.com/help/article/creative-best-practices) · [Hoox: winning UGC formats](https://www.hoox.video/en/blog/ugc-for-facebook-and-tiktok-ads-best-practices-and-winning-formats) · [Vidovo: the 3-second hook](https://www.vidovo.com/blog/ugc-hook-examples-how-brands-can-create-better-ugc-ads-in-the-first-3-seconds).

**The honest line on "proven":** the *craft* below (lighting, shot grammar, Gemini's "describe don't
keyword" rule, Veo's formula, the UGC hook structure) is proven and cited. **Which hook/offer
*converts* for a given product is not** — that's proven only by testing (≥3 hooks, same body, equal
budget, 48–72h, measure thumb-stop & completion). The templates ship the proven *form*; the research +
run-rating loop proves the *winner*.

---

## How to write a good prompt (user guide)

### Images — Google's official rules
- **Describe the scene as a narrative paragraph, not a keyword list.** Prose beats comma-soup. This is
  the single biggest fix to most people's prompts.
- **Think like a photographer.** Name the camera angle, lens, lighting, and fine detail for realism.
- **Cover six things:** subject · context · composition · action · style · editing instruction.
- **For product accuracy, edit the real photo.** Gemini keeps a subject's likeness across poses,
  lighting and scenes — establish the product, then place it. (This is Lyra's image-chaining.)
- **Keep it tight.** Gemini caps prompts at ~480 tokens; concise wins.
- **Start with "create an image of…" / "generate a photo of…"** so the model returns an image, not text.

### Video — Veo's official 5-part formula
> **[Camera] + [Subject] + [Action] + [Context] + [Style & Ambiance]**
> *Google's own example: "Medium shot, a tired corporate worker, rubbing his temples in exhaustion, in
> front of a bulky 1980s computer in a cluttered office late at night."*

One clear action per clip. State the shot size and one camera move with a reason.

### UGC ads — TikTok/Meta proven structure
- **The first 3 seconds decide everything** — the 3-second hold rate predicts completion, CTR, and
  conversion.
- **Structure:** Hook 0–3s (face-to-camera / direct question / movement) → Problem 3–10s → Solution +
  demo + proof 10–20s.
- **Format:** 15–30s, 9:16, front-load the value, close the loop by ~15s.
- **Make it feel user-posted** — too polished/promotional gets ignored. UGC runs ~$5–15 CPM (below the
  ~$9.16 average) and 85% of people trust UGC over brand-made content.

### Reusable tokens
Write product specifics as tokens so one template serves every product:
`{product}` · `{niche}` · `{audience}` · `{offer}` (drop `{offer}` into on-screen text for ad variants).

---

## Default templates

All clean-room, CC0, typed for the library. Product-hero + UGC image are type `image`; the ad set is
type `video`. Product-hero templates **edit the real product photo** (passed as the input image).

### Product-hero — `image` (Gemini: narrative + photographer framing, product kept accurate)

1. **White-background catalog hero**
   `Create an image of {product} centered on a clean white seamless background. Keep its exact shape, proportions and branding. Soft even studio lighting, gentle contact shadow, eye-level, shot on a 50mm lens. Crisp premium catalog look. 1:1.`
2. **Lifestyle in-context**
   `Generate a photo of {product} in a real {niche} setting where it would actually be used. Keep the product exactly accurate; style the scene around it. Soft natural window light, shallow depth of field, product in sharp focus. 4:5.`
3. **Detail / feature macro**
   `Create a macro close-up of {product} highlighting its key feature and texture. Preserve true colors and branding. Soft dramatic side light, dark moody background, fine detail. 9:16.`
4. **Brand-graded surface**
   `Generate a photo of {product} on a surface graded to the brand's {niche} color world. Keep the product accurate; make the scene feel premium and on-brand. Soft directional light, subtle reflection. 4:5.`
5. **Floating dynamic studio**
   `Create an image of {product} floating against a soft gradient studio backdrop with a clean drop shadow below. Keep its exact shape and branding. Crisp rim light, weightless premium feel. 1:1.`
6. **Scale-in-hand**
   `Generate a realistic photo of a hand holding {product} to show its real size, neutral background, soft daylight, product in sharp focus, true proportions and branding preserved. 4:5.`

### UGC — `image` (casual, real, phone aesthetic — fight the "too perfect" look)

7. **Selfie with product**
   `Create a phone selfie of a real everyday person holding {product} in a {niche} home, natural daylight, genuine half-smile, slightly imperfect handheld framing. Shot on a phone — no studio lighting, no retouching. 9:16.`
8. **POV unboxing**
   `Generate a first-person POV photo: a hand holding {product} just unboxed, packaging visible, real living-room background, soft window light, authentic and slightly messy phone-camera look. 4:5.`
9. **In-use moment**
   `Create a candid photo of a {audience} person actually using {product} for {niche}, caught mid-action, real lived-in background, natural light, relatable not staged. Phone-photo aesthetic. 4:5.`
10. **"In my life" shelf**
    `Generate a casual phone snapshot of {product} among everyday items on a bathroom shelf or desk, real and lived-in, soft morning light, no perfect styling. 1:1.`
11. **Before / after**
    `Create a real, casual side-by-side phone photo showing the {niche} situation before and after using {product}, natural light, honest and unpolished, no studio look. 4:5.`
12. **Genuine reaction**
    `Generate a phone photo of a {audience} person with a genuine delighted reaction holding {product}, real home background, natural light, authentic candid expression. 9:16.`

### UGC / ad — `video` (Veo 5-part formula + TikTok/Meta hook→problem→solution)

13. **Hook + demo**
    `Handheld front-facing phone selfie [camera] — a relatable {audience} person [subject] holds up {product}, delivers a hook line, then demonstrates it solving a {niche} problem [action], in a real lived-in home [context]. Raw unedited UGC, ring-light glow, genuine energy, 9:16, ~15–20s [style]. Beat order: visual hook in first 3s → problem → demo with proof. On-screen text: {offer}.`
14. **Problem → solution**
    `Medium handheld phone shot [camera] of a {audience} person [subject], first frustrated by the {niche} problem then relieved using {product} [action], real home [context]. Casual UGC, natural light, 9:16, ~15s [style]. Hook on the frustration in the first 3s.`
15. **Unboxing / first impression**
    `Close handheld phone video [camera], hands [subject] open {product}'s packaging, lift it out, turn it to show the key feature with a genuine reaction [action], real desk background, soft daylight [context]. Raw UGC, slight shake, 9:16, ~15s [style].`
16. **Hero in motion (image→video)**
    `Slow cinematic push-in [camera] on {product} [subject], gentle rotation revealing the label [action], clean studio surface with soft sweeping light [context], premium and crisp, one smooth move, 9:16, 4–6s [style]. Keep the product exactly accurate. Pairs with a product-hero image as input.`
17. **Testimonial / talking-head**
    `Front-facing phone shot [camera], a {audience} person [subject] talks to camera giving an honest short review of {product} and one concrete result [action], real home, soft natural light [context]. Authentic UGC testimonial, 9:16, ~20s [style]. Hook with the result in the first 3s.`
18. **"Why I switched"**
    `Handheld phone shot [camera], a {audience} person [subject] compares their old {niche} approach to using {product} and explains why they switched [action], relatable home setting [context]. Casual honest UGC, natural light, 9:16, ~20s [style]. Open on the old frustration in the first 3s.`

---

## Seeding notes

- All 18 are **CC0** and tokenized — import as typed library defaults (image/video) the same way the
  marketplace catalog is seeded.
- Quality over quantity: these set the **house style**. Add more by following the same grounded formulas
  (or generate variants with an LLM step), not by scraping non-CC0 galleries.
- The guide section can render directly as the in-app "How to write a good prompt" helper.
