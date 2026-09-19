# SQE Practice · 刷题室

## 题库入口

### [▶ 进入 SQE GitHub 题库](https://ringo-deng.github.io/sqe-practice/)

独立运行于 GitHub Pages；答题记录、生词和教材笔记保存在当前浏览器。

A public-access SQE practice application with an account-backed mode and a device-local guest mode. The current release contains 2,996 questions: 220 SRA samples, 360 Revise SQE practice-assessment questions, all 654 end-of-chapter SQE1-style questions found across the 14 uploaded Revise SQE 2027 textbooks, and 1,762 retained questions from QLTS Mock Exam source sets 1–30. OUP remains available as an empty library category until imported.

## Product

- English question stems and choices, with pre-generated Chinese for the SRA, Revise and QLTS collections in learning mode. The QLTS scan import preserves the original English text and explanation and adds a separate Simplified Chinese translation layer. Existing reviewed translations are retained; no browser-side translation or language-model download is required while studying.
- Server-graded practice answers with Chinese-led explanation and selected English terminology, key rule, option-by-option analysis, exam warning and legislation links.
- Timed examination mode with a server-enforced deadline. No grading or explanation is returned before submission. Unanswered questions count as incorrect on submission.
- Signed-in sessions, navigation position, answers and cumulative statistics are stored in D1 and keyed by the platform-authenticated user. Anonymous visitors keep the corresponding study state in their current browser.
- Mistake review shows questions whose latest graded answer is incorrect and removes each question as soon as it is answered correctly. Practice questions show cumulative correct and incorrect submitted-answer counts; original answer history is preserved.
- “复制本题” copies the current question and selected choice for external tutoring, adding the answer, source-labelled explanation and textbook references only when the answer is revealed. Textbook body text is excluded. If clipboard access fails, a selectable text dialog provides a manual fallback.
- Private platform access and server-side user scoping; no app-owned password database or external AI API keys.

## Data and maintenance

`lib/questions.ts` combines the imported provider datasets on the server. `lib/study-types.ts` contains the transport types. Future imported questions should retain their provider, source question number, edition and original explanation; any supplementary content must remain distinguishable.

The QLTS import is split into files covering Mocks 1–5, 6–10, 11–15, 16–20 and 21–30. Matching `-source.json` files record source hashes, page counts and exclusions; matching `-translations.json` files provide the reviewed Simplified Chinese layer. The active QLTS bank contains 1,762 questions. Mocks 1–20 retain 1,362 questions, with Mock 18 (pre-Brexit substantive EU law) and Mock 19 (the former SRA Handbook) fully excluded. Mock 3 lacks Q25–27 and has no answer capture for Q24; Mock 4 Q75 is obscured by a browser certificate dialog.

Mocks 21–30 contain 531 original questions: 400 are retained and 131 excluded after current-law and source-quality review dated 19 September 2026. Retained counts are 48 / 51 / 25 / 19 / 29 / 56 / 23 / 50 / 26 / 73. Exclusions cover superseded tax rates and thresholds, changed accounting and financial-services rules, outdated court procedure and insurance/illegality rules, and separately identified substantive publisher errors. Historical dates and old citation numbering alone are not exclusion grounds: retained historical citations remain verbatim and their limitations are recorded in `qlts-mock-exams-21-30-removed.json`. No original question is silently rewritten into a current-law question. Across Mocks 6–30, 429 questions have been excluded following review. Each retained question keeps its original number, English text, publisher answer and PDF page references, with a separate Chinese translation and a reviewed chapter link. Source PDFs and intermediate OCR are not bundled with this repository.

`db/schema.ts` owns the schema. Generated migrations are in `drizzle/`. Never edit an applied migration. D1 is declared as `DB` in `.openai/hosting.json`. Signed-in records remain server-side; guest study records, vocabulary, annotations and guest-imported PDFs stay in that visitor's browser.

`app/api/study/route.ts` validates and grades signed-in write flows. The host supplies authenticated-user headers. `app/api/guest-study/route.ts` validates and grades anonymous actions without retaining them server-side; the returned state is saved by the visitor's browser.

## Validation

- The production build passes with the imported SRA and Revise datasets.
- Authentication, user isolation, persistent navigation, hidden answer keys, repeat-submit idempotence, mistake tracking and server-side examination timing remain enforced by the API.
- Removed demonstration questions and their legacy sessions are excluded from question totals, history and cumulative statistics.

Use the Sites build and hosting scripts to publish; preserve this Site's existing project identity and current audience. The project uses pnpm.


## Subject library and inline reviews

The subject library shows 13 study entries with FLK1 followed by FLK2. Legal Services and the former standalone FLK2 ethics entry share one “法律服务与职业道德” entry; ethics remains explicitly labelled as pervasive across FLK1 and FLK2. Cards display actual dataset counts for the selected source, and empty subjects cannot start a session. Subject selection is validated and filtered by the API; obsolete demonstration sessions are omitted without deleting stored records.

The classification reviewed on 19 September 2026 follows the [SRA specification effective 1 September 2026](https://sqe.sra.org.uk/assessments/sqe1-assessments/sqe1-specification) and [FLK1 subject outline](https://sqe.sra.org.uk/assessments/sqe1-assessments/sqe1-specification/flk1). The combined entry contains 294 questions across all sources, arranged as six study topics: SRA regulation and equality (23), money laundering (56), financial services (75), funding (12), SRA Principles (7), and Codes of Conduct / ethics in practice (121). The former FLK2 ethics entry contained only 25 separately imported questions; it was never the total ethics coverage of the bank. Other subjects may also assess ethical issues.

`lib/legal-syllabus.ts` applies a reviewed classification layer after publisher chapter matching. Seven questions move to their primary practice areas: two criminal legal-aid questions to Criminal Practice, two partnership/company questions to Business, and three client-money questions to Accounts. Accounts remains a separate FLK2 practice entry (138 questions), examined within property and estates contexts under the [FLK2 outline](https://sqe.sra.org.uk/assessments/sqe1-assessments/sqe1-specification/flk2). The total remains 2,996. Question IDs, order, text, translations, answers, source sets and textbook references are unchanged. `originalSubjectId` / `originalChapterId` retain the previous classification, and saved sessions and statistics continue to resolve the same question IDs. Publisher chapters remain available through `textbookChapters`; the six syllabus topics replace the mixed 05–08 / 01–08 chapter lists only in the study grouping. This classification review does not revalidate every historical publisher answer against current law.

Run `node scripts/check-syllabus-classification.cjs` for classification, source filtering, guest/API session recovery, scoring and mistake-history regression checks.

Answers appear directly below the question. The explanation starts with three concise revision points and one exam warning, followed by Chinese reasoning and option analysis. Each point pairs a bold English term with a short Chinese rule. Explanations keep only relevant English legal terms, statute names and exam phrases; repeated English paragraphs and the explanation-language tabs have been removed. The question and option translation toggle remains unchanged. Long teaching passages, examples, comparison tables and recall prompts have been removed. Legislation links remain available. These are AI-authored supplementary notes, not provider explanations or full syllabus coverage. Both answer explanations and knowledge notes are omitted from API responses until that question is graded; active exam answers stay concealed until submission.

Checks for this update: TypeScript compilation, production build, and 18 isolated API/data checks at the subject-library release, including subject filtering, empty subjects, hidden knowledge before grading, bilingual completeness, existing result persistence, user isolation and timed examination behavior. The subsequent concise-review change is checked through TypeScript and the production build. No browser QA was requested for this change.
