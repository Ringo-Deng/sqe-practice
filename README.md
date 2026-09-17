# SQE Practice · 刷题室

A private SQE practice application. The current release contains 580 questions: 290 FLK1 questions and 290 FLK2 questions from the imported SRA sample sets and Revise SQE practice assessments. QLTS and OUP remain available as empty library categories until imported.

## Product

- English question stems and choices; optional Chinese in learning mode.
- Server-graded practice answers with Chinese-led explanation and selected English terminology, key rule, option-by-option analysis, exam warning and legislation links.
- Timed examination mode with a server-enforced deadline. No grading or explanation is returned before submission. Unanswered questions count as incorrect on submission.
- D1-backed sessions, navigation position, answers and cumulative statistics keyed by the platform-authenticated user.
- Mistake review distinguishes unresolved errors from subsequently corrected questions and preserves the original history.
- Private platform access and server-side user scoping; no app-owned password database or external AI API keys.

## Data and maintenance

`lib/questions.ts` combines the imported provider datasets on the server. `lib/study-types.ts` contains the transport types. Future imported questions should retain their provider, source question number, edition and original explanation; any supplementary content must remain distinguishable.

`db/schema.ts` owns the schema. Generated migrations are in `drizzle/`. Never edit an applied migration. D1 is declared as `DB` in `.openai/hosting.json`. No user learning records are kept in browser storage.

`app/api/study/route.ts` validates and grades the write flows. The private host supplies authenticated-user headers. Anonymous API requests are rejected, and the UI offers a top-level sign-in link when necessary.

## Validation

- The production build passes with the imported SRA and Revise datasets.
- Authentication, user isolation, persistent navigation, hidden answer keys, repeat-submit idempotence, mistake tracking and server-side examination timing remain enforced by the API.
- Removed demonstration questions and their legacy sessions are excluded from question totals, history and cumulative statistics.

Use the Sites build and hosting scripts to publish; preserve this Site's existing project identity and private audience. The project uses pnpm.


## Subject library and inline reviews

The subject library shows the 13 syllabus areas with FLK1 followed directly by FLK2, plus a separate FLK2 ethics filter for the pervasive professional-conduct questions. Cards display actual dataset counts, and empty subjects cannot start a session. Subject selection is validated and filtered by the API; obsolete demonstration sessions are omitted without deleting stored records.

Answers appear directly below the question. The explanation starts with three concise revision points and one exam warning, followed by Chinese reasoning and option analysis. Each point pairs a bold English term with a short Chinese rule. Explanations keep only relevant English legal terms, statute names and exam phrases; repeated English paragraphs and the explanation-language tabs have been removed. The question and option translation toggle remains unchanged. Long teaching passages, examples, comparison tables and recall prompts have been removed. Legislation links remain available. These are AI-authored supplementary notes, not provider explanations or full syllabus coverage. Both answer explanations and knowledge notes are omitted from API responses until that question is graded; active exam answers stay concealed until submission.

Checks for this update: TypeScript compilation, production build, and 18 isolated API/data checks at the subject-library release, including subject filtering, empty subjects, hidden knowledge before grading, bilingual completeness, existing result persistence, user isolation and timed examination behavior. The subsequent concise-review change is checked through TypeScript and the production build. No browser QA was requested for this change.
