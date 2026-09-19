export const BACKUP_APPLICATION = 'sqe-practice' as const;
export const BACKUP_SCHEMA_VERSION = 2 as const;
export const BACKUP_TABLES = ['sessions', 'responses', 'vocabulary', 'textbook_annotations', 'textbook_titles', 'textbook_bookmarks', 'user_textbooks', 'reading_positions'] as const;
export type BackupTable = typeof BACKUP_TABLES[number];

export type BackupSession = {
  id: string; user_id: string; mode: 'practice' | 'exam' | 'wrong'; status: 'active' | 'finished';
  question_ids: string; position: number; started_at: number; finished_at: number | null;
};
export type BackupResponse = {session_id: string; question_id: string; selected: string; correct: number; answered_at: number};
export type BackupVocabulary = {
  id: string; user_id: string; word: string; word_key: string; kind: 'term' | 'word'; meaning: string; example: string;
  question_id: string | null; session_id: string | null; subject_id: string | null; source_label: string;
  stage: number; next_review: string; review_count: number; last_reviewed_at: number | null;
  last_reviewed_date: string | null; queue_date: string | null; queue_order: number;
  created_at: number; updated_at: number; revision: number;
};
export type BackupAnnotation = {
  id: string; user_id: string; book_id: string; page: number; quote: string; note: string; color: 'yellow';
  rects: string; source_question_id: string | null; created_at: number; updated_at: number; revision: number;
};
export type BackupTitle = {user_id: string; book_id: string; title: string; subject_id: string | null; updated_at: number; revision: number};
export type BackupBookmark = {user_id: string; book_id: string; page: number; note: string; created_at: number; updated_at: number; revision: number};
export type BackupTextbook = {
  id: string; user_id: string; title: string; subject_id: string; original_name: string; page_count: number;
  storage_key: string; size_bytes: number; created_at: number; updated_at: number; revision: number;
};
export type BackupReadingPosition = {user_id: string; book_id: string; page: number; updated_at: number};
export type BackupData = {
  sessions: BackupSession[]; responses: BackupResponse[]; vocabulary: BackupVocabulary[];
  textbook_annotations: BackupAnnotation[]; textbook_titles: BackupTitle[];
  textbook_bookmarks: BackupBookmark[]; user_textbooks: BackupTextbook[]; reading_positions: BackupReadingPosition[];
};
export type StudyBackup = {
  application: typeof BACKUP_APPLICATION;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  sourceAccountId: string;
  data: BackupData;
  files: {included: false; kind: 'metadata-only'; count: number};
};
/** Version 1 archives predate account reading positions and remain importable. */
export type LegacyStudyBackup = Omit<StudyBackup, 'schemaVersion' | 'data'> & {
  schemaVersion: 1;
  data: Omit<BackupData, 'reading_positions'>;
};
export type LegacyStudyMigrationReport={
  format:'sqe-practice-legacy-study';scope:'study-only';receivedSessions:number;receivedAnswers:number;
  unknownQuestionIds:string[];
  skippedSessions:{sessionId:string;reason:'no-known-questions'}[];
  skippedAnswers:{sessionId:string;questionId:string;reason:'unknown-question'|'invalid-option'}[];
};
export type BackupRestoreResult = {
  ok: true;
  mode: 'merge-preserve-existing';
  migration?:LegacyStudyMigrationReport;
  tables: Record<BackupTable, {received: number; inserted: number; skipped: number}>;
  files: {
    restored: false;
    requiresUpload: {id: string; title: string; originalName: string; sizeBytes: number}[];
  };
};
