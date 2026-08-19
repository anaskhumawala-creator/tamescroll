# Keyword/text-signal filtering research for tamescroll

Research date: 2026-08-19. Web research only, facts + sources, no code changes.

## 1. Mechanisms — how inappropriate/sexualized content creeps into ordinary and children's feeds

### YouTube — Elsagate pattern (recognized character names as bait)
- Academic study "Disturbed YouTube for Kids: Characterizing and Detecting Inappropriate Videos Targeting Young Children" (ICWSM 2020) manually reviewed toddler-oriented videos and found **video title is a strong predictor of whether disturbing content gets recommended alongside other kids' videos**. Concrete rates of disturbing content among videos whose *title* contained a popular character name: "spiderman" 82.6%, "mous"(e) 80.4%, "peppa" 78.6%, "superhero" 76.7%, "pig" 76.4%, "frozen" 63.5%, "elsa" 62.5%.
  [Disturbed YouTube for Kids (ar5iv)](https://ar5iv.labs.arxiv.org/html/1901.07046) / [ICWSM PDF](https://ojs.aaai.org/index.php/ICWSM/article/download/7320/7174/10550) / [ResearchGate](https://www.researchgate.net/publication/330552844_Disturbed_YouTube_for_Kids_Characterizing_and_Detecting_Inappropriate_Videos_Targeting_Young_Children)
- Same paper: **tags are a weaker signal than titles** — disturbing and legitimate kids' videos share the same popular tags ("spiderman" tag 74.4% disturbing, "mous" tag 73.0%), so tags alone cause false positives; titles are more discriminative but still not sufficient alone — no single textual marker is fully reliable, human/video-content review is still needed.
- Mechanism named by the paper: YouTube's moderation historically relied on **user reporting + manual employee review**, which does not scale to upload volume — this is the structural gap keyword/text heuristics exist to plug at the edges.
- Related: "EXAMINING THE 'ELSAGATE' PHENOMENON" (AoIR) confirms the same character-exploitation pattern as a recurring genre.
  [AoIR paper](https://spir.aoir.org/ojs/index.php/spir/article/download/10921/9594/70877)

### YouTube — recommender-driven "borderline content" / clickbait
- Guillaume Chaslot (ex-YouTube recommendation engineer): the recommender's incentive is to surface "borderline content that's very engaging, but not forbidden" because it maximizes watch time; he built AlgoTransparency to track this.
  [TNW interview](https://thenextweb.com/news/youtube-recommendations-toxic-algorithm-google-ai) / [AlgoTransparency](https://www.algotransparency.org/)
- YouTube's own 2019 policy response: began "reducing recommendations of borderline content" (flat-earth, fake miracle cures, 9/11 conspiracy) — but such videos remain hosted, only de-amplified, so they still surface via search/thumbnail bait, not eliminated.
- Clickbait thumbnails specifically target children: shocking/dramatic/scary imagery paired with character names drives clicks regardless of actual content match — documented in academic clickbait-detection literature (Penn State CHECKER paper, arXiv 2112.08611) and consumer reporting on "clickbaiting kids."
  [CHECKER paper](https://pike.psu.edu/publications/ecmlpkdd21.pdf) / [Clickbait in YouTube arXiv](https://arxiv.org/pdf/2112.08611) / [Yahoo/reporting piece](https://www.yahoo.com/news/clickbaiting-kids-youtubes-problem-shocking-110717756.html)

### TikTok — search-suggestion and For You algorithmic push
- Global Witness (Oct 2025), 7 fresh UK accounts registered as 13-year-olds, factory-reset phones, Restricted Mode **on**: sexually explicit search terms were suggested "the very first time" 3 of 7 accounts tapped the search bar; all 7 accounts reached pornographic content within a small number of clicks — as few as **2 clicks** from account creation. Restricted Mode did not prevent this. Assessed as a likely breach of the UK Online Safety Act.
  [Global Witness report](https://globalwitness.org/en/campaigns/digital-threats/tiktok-directs-13-year-olds-to-porn/) / [press release](https://globalwitness.org/en/press-releases/tiktok-search-suggestions-lead-13-year-olds-to-porn-on-sign-up-apparently-breaching-the-online-safety-act/) / [CNN coverage](https://www.cnn.com/2025/10/03/tech/tiktok-pushed-sexually-explicit-search-terms-to-13-year-olds-report)
- Maldita.es investigation (Dec 2025): TikTok's For You / search recommended videos sexualizing minors; identified **40 accounts, 1.5M+ combined followers**, publishing this content, forming a recommendation loop that put users a few clicks from CSAM-adjacent content.
  [Maldita.es](https://maldita.es/investigaciones/20251211/responsibility-tiktok-profiles-sexualizing-minors/)
- Academic measurement: "More Skin, More Likes! Measuring Child Exposure and User Engagement on TikTok" (arXiv 2408.05622) — analyzed 432,178 comments across 5,896 videos: **19.57% of videos depicted children in revealing clothing** (swimwear, bare midriffs); these got significantly more appearance-focused comments and likes than fully-clothed-child videos (21% of comments were appearance-focused, including "inappropriate comments or contact offers"). Engagement (likes/comments), not downloads, is what correlates with skin exposure — i.e. the *engagement signal itself* rewards this content, independent of any keyword evasion.
  [arXiv abstract](https://arxiv.org/abs/2408.05622)
- Related dataset paper on unsafe-content markers: "Catching Dark Signals in Algorithms: Unveiling Audiovisual and Thematic Markers of Unsafe Content Recommended for Children and Teenagers" (arXiv 2507.12571) — exists but full text wasn't parseable in this session; flagged for anyone doing a deeper follow-up.
  [arXiv PDF](https://arxiv.org/pdf/2507.12571)

### Instagram — Reels recommender
- WSJ investigation (with Stanford / UMass Amherst researchers) + independent researcher tests: Instagram's Reels algorithm recommended sexually suggestive adult-creator content to accounts registered as 13-year-olds within **as little as 3 minutes** of Reels viewing; such content **dominated the feed after ~20 minutes**.
- Same investigation: Instagram's recommendation system was found to actively **connect pedophiles to each other and to content sellers** via "people you may know" / interest-linking, because the system excels at linking users who share niche interests — the same mechanism that works for legitimate hobbies works for illicit demand.
- Internal Meta research (undisclosed until reporting surfaced it): found elementary-school-age kids using the platform despite the under-13 ban, and that Instagram's recommendation algorithm "actively incentivized children under 13 to perform risky sexualized behaviors" via inappropriate amplification.
  [Incident DB summary](https://incidentdatabase.ai/cite/788/) / [Benzinga](https://www.benzinga.com/news/24/06/39407404/instagram-algorithm-continues-to-recommend-sexual-content-to-teen-accounts-despite-metas-promises-re) / [Time — Instagram Teen Accounts flawed (2025)](https://time.com/7324544/instagram-teen-accounts-flawed/)

### Cross-cutting mechanism summary
1. **Recognizable-brand bait** — bad actors attach trusted kids'-media names (Elsa, Spiderman, Peppa) to titles/tags/thumbnails to get algorithmic placement next to legitimate content.
2. **Engagement-driven amplification** — recommenders optimize watch time / likes / comments; borderline and skin-exposing content generates outsized engagement, so the algorithm promotes it independent of any deliberate evasion.
3. **Search-suggestion funnels** — autocomplete/search-suggestion surfaces (not just the main feed) actively suggest escalating explicit terms after minimal signal, sometimes within 1-2 interactions, even with "safe mode" toggles on.
4. **Interest-graph linking** — "similar users" / "people you may know" style graph features connect illicit-interest users to each other and to sellers, same mechanism as normal interest-based discovery.
5. **Under-scaled human moderation** — platforms still lean on user-report + manual-review queues that can't keep pace with upload volume, leaving a persistent gap that automated client-side filtering (like keyword filters) is meant to narrow, not close.

---

## 2. Text signals — concrete patterns

### Channel/creator name and title patterns (from research above)
- Popular children's-character names used as bait keywords in titles/tags even on non-kids content: spiderman, elsa/frozen, peppa (pig), mickey/"mous", superhero.
- Clickbait titles: shock/scare words, superlatives, unresolved-question phrasing, mismatched title-vs-thumbnail claims (documented in clickbait-detection literature generally, not sexual-content-specific).

### Algospeak / evasion vocabulary (documented in peer-reviewed study + journalism)
Source: Steen, Yurechko & Klug, "You Can (Not) Say What You Want: Using Algospeak to Contest and Evade Algorithmic Content Moderation on TikTok," *Social Media + Society* 2023.
[SAGE journal](https://journals.sagepub.com/doi/10.1177/20563051231194586) / [NSF-hosted PDF](https://par.nsf.gov/servlets/purl/10480449) / [IJNet explainer](https://ijnet.org/en/story/unaliving-language-online-how-journalists-can-decode-%E2%80%98algospeak%E2%80%99-social-media) / [Merriam-Webster slang entry](https://www.merriam-webster.com/slang/algospeak)

Concrete terms documented:
- "unalive" = suicide/kill (whole new word — found *most* effective at evading moderation)
- "seggs" = sex
- "corn" = porn (also appears independently in the Global Witness TikTok findings as a moderation-evasion term used in the wild)
- "cornhub"-style brand-name substitutions (pattern: swap a letter/word in a well-known adult-site or explicit-term brand)
- "lebanese" = lesbian
- "leg booty" = LGBTQ
- "accountant" = sex worker
- Leetspeak substitutions (e.g. "s3x") — the study found these are the *weakest* form of evasion; TikTok's own moderation reportedly already catches simple leetspeak, while entirely new coined words are harder for classifiers to catch. Implication for tamescroll: a naive substring/leetspeak-normalizing filter catches the easy cases; coined euphemisms need a maintained wordlist, not a transform.

### Suggestive emoji (general consumer/lifestyle sourcing, not academic — used descriptively, treat as lower-confidence than the above)
- 🍆 (eggplant) = penis, 🍑 (peach) = buttocks/female anatomy — the two most広widely recognized.
- 💦 (water droplets) = arousal/"wet," commonly paired with 🍆.
- 👉 + 👌 (pointing + OK sign) = sexual-act emulation.
- Broader suggestive-food set observed in usage: 🍕 🍩 🌽 🌶️ 🍭 🍾 🌮 🥖 🍯 🍒 🍻 🍈 🍣 🍌.
  [Wikipedia — Eggplant emoji](https://en.wikipedia.org/wiki/Eggplant_emoji) / [Grindr blog](https://www.grindr.com/blog/sexting-emojis) / [Gabb parents' guide](https://gabb.com/blog/sexual-emojis/)
- Caveat: these sources are lifestyle/parenting blogs, not peer-reviewed — good for a starter emoji-flag list, not to be over-trusted as exhaustive or as sole confidence signal (many uses are innocuous/contextual).

---

## 3. Usable open-source keyword/term lists (license-checked)

| List | URL | License | Size | Notes |
|---|---|---|---|---|
| **LDNOOBW** (List of Dirty, Naughty, Obscene, and Otherwise Bad Words) | [github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) | **CC BY 4.0** (Creative Commons Attribution) — confirmed via repo footer/README | 30+ language lists; English list size not confirmed in this pass | Originated at Shutterstock (autocomplete/recommendation filtering, 2012-2020), open for community PRs. **CC BY 4.0 is NOT on tamescroll's allowed list (MIT/Apache/CC0/BSD only)** — it requires attribution, which is compatible with those norms in spirit but is a different license family. Flag for owner: usable only if owner is OK satisfying CC BY attribution (credit Shutterstock/LDNOOBW in NOTICE), otherwise excluded per hard rule. |
| **badwords-list** (npm, forked from "badwords") | npm: `badwords-list` | **MIT** (per npm search results; could not confirm via direct fetch — 403) | not confirmed | Verify license file directly before use; npm listing states MIT. |
| **dsojevic/profanity-list** | [github.com/dsojevic/profanity-list](https://github.com/dsojevic/profanity-list) | **MIT** (confirmed via repo) | **434 profanities / 809 total match patterns** | Best candidate found: per-entry severity (1-4 mild→severe), category tags (general, lgbtq, racial, religious, sexual, shock), wildcard (`*`) support, explicit `allow_partial` boolean per entry to control substring vs whole-word matching, JSON + plain text formats. Directly usable as a seed list with tagging already done for "sexual" category filtering. |
| **jo3-l/obscenity** (npm `obscenity`) | [github.com/jo3-l/obscenity](https://github.com/jo3-l/obscenity) | **MIT** (confirmed via repo LICENSE badge) | library, not raw wordlist | Not a wordlist but a matching *engine*: transformer-based design catches unicode variants, character repetition ("fuuuuuuuckkk"), leetspeak, and word-boundary insertion attacks without hand-listing every variant. Ships with a default phrase set that's extensible/removable. Explicitly documents itself as "not perfect," recommends use as a heuristic signal, not sole judge — matches tamescroll's likely need (client-side, in-app, imperfect-by-design signal, not a legal takedown tool). |
| **glin-profanity** | [github.com/glincker/glin-profanity](https://github.com/glincker/glin-profanity) | Described as open-source, license not verified this pass | — | Claims leetspeak + Unicode-obfuscation resistance, 23 languages, TensorFlow.js toxicity scoring. Verify LICENSE file before use; not fetched/confirmed in this session. |
| french-badwords-list | github.com/darwiin/french-badwords-list | MIT (per search result) | — | Only relevant if/when tamescroll needs non-English lists. |

**Not usable / not checked further:** anything GPL/AGPL is out per project hard rule regardless of quality — did not find an AGPL/GPL list worth flagging as a near-miss in this pass.

**Recommendation on LDNOOBW specifically:** don't ship it as-is without an explicit owner OK, because CC BY 4.0 isn't on the pre-approved license list even though it's a permissive/free license — this is exactly the kind of licensing edge case the hard rule exists to catch. `dsojevic/profanity-list` (MIT, tagged, sized similarly) is a drop-in substitute that avoids the question entirely.

---

## 4. How existing tools do text-signal filtering — precedents

### BlockTube (amitbl/blocktube, Firefox/Chrome, YouTube)
- Fields matched: **video title, channel name, channel ID, video ID, comment author, comment text**.
- Supports plain keyword matching (auto word-boundary aware — blocking "you" does not match "youtube") **and** raw regex (wrap pattern in `/…/` for substring/complex matches).
- Users maintain personal blocklists; community-shared lists exist (e.g. `iansquenet/minimaltube-list` — a personal BlockTube list mixing title keywords + channel IDs), showing the pattern of **user-authored + user-extendable text rule sets** as the norm in this space, not a single canonical list.
  [BlockTube GitHub](https://github.com/amitbl/blocktube) / [Filters wiki](https://github.com/amitbl/blocktube/wiki/Filters-Options) / [example community list](https://github.com/iansquenet/minimaltube-list)

### YouTube-Video-Blocker (oiaren/Yonezpt forks)
- Simpler model: hides videos based on specific words appearing in **either channel name or video title** — no regex, just substring/keyword list. Shows the minimum viable version of this feature.
  [github.com/oiaren/Youtube-Video-Blocker](https://github.com/oiaren/Youtube-Video-Blocker)

### YTBlock / "YouTube Video and Channel Blocker" (Chrome Web Store extensions)
- Same field set (title, channel, sometimes comments/playlists) with regex support and asterisk-wildcard mode for non-technical users — i.e. **two-tier UX**: simple wildcard mode for most users, full regex for power users. Worth mirroring for tamescroll's settings pane (owner already has a "Bring back" Hidden/Shown pills pattern that a similar two-tier keyword UI could sit next to).
  [Chrome Web Store listing](https://chromewebstore.google.com/detail/ytblock-block-any-content/nedcanggplmbbgmlpcjiafgjcpdimpea)

### Lesson across all of them
No tool relies on a single static list shipped once — every precedent pairs a **starter list** with **user-editable/importable rules**, because keyword lists go stale (new euphemisms) and every user's threshold differs. This validates a "seed list + user-extendable" design rather than trying to ship an exhaustive, unmaintained blocklist.

---

## 5. Recommended starter approach for tamescroll

**Match fields:** channel/creator name + video/post title, mirroring the BlockTube/YouTube-Video-Blocker precedent — these are the two fields every prior-art tool treats as primary, and both are cheap to read client-side (already visible in the DOM tamescroll injects into) without needing thumbnail/video analysis.

**Seed list:** `dsojevic/profanity-list` (MIT, 434 profanities/809 match patterns, pre-tagged with a `sexual` category and per-entry severity) as the base — filter to the `sexual`/`shock` tags for the "inappropriate content" use case rather than importing all profanity categories (tamescroll isn't a general profanity filter). Layer on a small **hand-maintained algospeak supplement** since no license-clean list of coined evasion terms exists yet: seggs, corn (context-gated — "corn" alone is too noisy, pair with other flags), unalive, leg booty, accountant (context-gated), lebanese (context-gated — also an ethnonym, high false-positive risk), plus common leetspeak normalization (s3x, a$$, etc.) — reuse `obscenity`'s (MIT) transformer approach for leetspeak/unicode/repeat-character normalization instead of hand-coding it, since that's exactly the gap that library fills and the project already avoids reinventing engines where a licensed one exists.

**Emoji flags:** small supplementary list (🍆 🍑 💦 as highest-confidence, rest of the suggestive-food set as lower-confidence/optional) — treat as a weak signal only, combined with text match, not standalone trigger, given the sourcing caveat above.

**User-extendable:** follow the BlockTube/YTBlock precedent — ship the seed list as tamescroll's default "on," but expose add/remove keyword UI (same shape as the existing Settings pane's Bring-back Hidden/Shown pills) so users can add their own terms/channels without waiting for an app update, and so false positives (e.g. "lebanese" as nationality) are locally correctable per user rather than requiring a central fix.

**What this does NOT solve:** per the Elsagate paper, title/tag text alone has real false-positive/negative rates — character-name bait titles are majority-disturbing but not exclusively so, and tags are barely discriminative at all. Text-signal filtering is a **cheap first-pass heuristic layered before/alongside the existing gaze/NSFW visual blur**, not a replacement for it — consistent with tamescroll's existing "blur-first, AI never in critical path" design.

---

## Sources not fully verified this session (flag for follow-up if needed)
- `badwords-list` npm license (npm page returned 403 on fetch; only search-snippet evidence of MIT).
- `glin-profanity` license (not fetched).
- LDNOOBW English list exact word count (not confirmed).
- "Catching Dark Signals in Algorithms" arXiv 2507.12571 full text (PDF didn't parse cleanly; only title/existence confirmed).
