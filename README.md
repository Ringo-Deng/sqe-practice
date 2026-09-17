# SQE Practice · 刷题室

## 题库入口

### [▶ 进入 SQE GitHub 题库](https://ringo-deng.github.io/sqe-practice/)

独立运行于 GitHub Pages；答题记录、生词和教材笔记保存在当前浏览器。

A public-access SQE practice application with an account-backed mode and a device-local guest mode. The current release contains 1,679 questions: 220 SRA samples, 360 Revise SQE practice-assessment questions, all 654 end-of-chapter SQE1-style questions found across the 14 uploaded Revise SQE 2027 textbooks, and 445 questions from QLTS Mock Exams 1–5. OUP remains available as an empty library category until imported.

## Product

- English question stems and choices, with pre-generated Chinese for the SRA and Revise collections in learning mode. The QLTS scan import preserves its original English text and explanation without adding an unreviewed translation. Existing reviewed translations are retained; no browser-side translation or language-model download is required while studying.
- Server-graded practice answers with Chinese-led explanation and selected English terminology, key rule, option-by-option analysis, exam warning and legislation links.
- Timed examination mode with a server-enforced deadline. No grading or explanation is returned before submission. Unanswered questions count as incorrect on submission.
- Signed-in sessions, navigation position, answers and cumulative statistics are stored in D1 and keyed by the platform-authenticated user. Anonymous visitors keep the corresponding study state in their current browser.
- Mistake review distinguishes unresolved errors from subsequently corrected questions and preserves the original history.
- Private platform access and server-side user scoping; no app-owned password database or external AI API keys.

## Data and maintenance

`lib/questions.ts` combines the imported provider datasets on the server. `lib/study-types.ts` contains the transport types. Future imported questions should retain their provider, source question number, edition and original explanation; any supplementary content must remain distinguishable.

The QLTS import is in `lib/qlts-mock-exams-1-5.json`; its source hashes, page counts and exclusions are recorded in `lib/qlts-mock-exams-1-5-source.json`. The five scanned PDFs supplied 445 complete questions: 90 / 90 / 86 / 89 / 90. Mock 3 lacks Q25–27 and has no answer capture for Q24; Mock 4 Q75 is obscured by a browser certificate dialog. Those five records were excluded instead of reconstructed. Each imported question retains its source PDF page numbers. The material is historical and has not been updated for current law or tax rates.

`db/schema.ts` owns the schema. Generated migrations are in `drizzle/`. Never edit an applied migration. D1 is declared as `DB` in `.openai/hosting.json`. Signed-in records remain server-side; guest study records, vocabulary, annotations and guest-imported PDFs stay in that visitor's browser.

`app/api/study/route.ts` validates and grades signed-in write flows. The host supplies authenticated-user headers. `app/api/guest-study/route.ts` validates and grades anonymous actions without retaining them server-side; the returned state is saved by the visitor's browser.

## Validation

- The production build passes with the imported SRA and Revise datasets.
- Authentication, user isolation, persistent navigation, hidden answer keys, repeat-submit idempotence, mistake tracking and server-side examination timing remain enforced by the API.
- Removed demonstration questions and their legacy sessions are excluded from question totals, history and cumulative statistics.

Use the Sites build and hosting scripts to publish; preserve this Site's existing project identity and current audience. The project uses pnpm.


## Subject library and inline reviews

The subject library shows the 13 syllabus areas with FLK1 followed directly by FLK2, plus a separate FLK2 ethics filter for the pervasive professional-conduct questions. Cards display actual dataset counts, and empty subjects cannot start a session. Subject selection is validated and filtered by the API; obsolete demonstration sessions are omitted without deleting stored records.

Answers appear directly below the question. The explanation starts with three concise revision points and one exam warning, followed by Chinese reasoning and option analysis. Each point pairs a bold English term with a short Chinese rule. Explanations keep only relevant English legal terms, statute names and exam phrases; repeated English paragraphs and the explanation-language tabs have been removed. The question and option translation toggle remains unchanged. Long teaching passages, examples, comparison tables and recall prompts have been removed. Legislation links remain available. These are AI-authored supplementary notes, not provider explanations or full syllabus coverage. Both answer explanations and knowledge notes are omitted from API responses until that question is graded; active exam answers stay concealed until submission.

Checks for this update: TypeScript compilation, production build, and 18 isolated API/data checks at the subject-library release, including subject filtering, empty subjects, hidden knowledge before grading, bilingual completeness, existing result persistence, user isolation and timed examination behavior. The subsequent concise-review change is checked through TypeScript and the production build. No browser QA was requested for this change.
