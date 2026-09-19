import {questions} from '../lib/questions';
import {LEGACY_STUDY_BACKUP_FORMAT,parseLegacyStudyBackup} from '../lib/legacy-study-backup';
import {BACKUP_APPLICATION,BACKUP_SCHEMA_VERSION,type LegacyStudyMigrationReport,type StudyBackup} from './backup-types';

const questionById=new Map(questions.map(question=>[question.id,question]));

/** Converts untrusted browser state into account-owned rows with server grading. */
export function prepareLegacyStudyImport(input:unknown,userId:string):{backup:StudyBackup;migration:LegacyStudyMigrationReport}{
 const source=parseLegacyStudyBackup(input);
 const backup:StudyBackup={
  application:BACKUP_APPLICATION,schemaVersion:BACKUP_SCHEMA_VERSION,exportedAt:source.exportedAt,sourceAccountId:userId,
  data:{sessions:[],responses:[],vocabulary:[],textbook_annotations:[],textbook_titles:[],textbook_bookmarks:[],user_textbooks:[],reading_positions:[]},
  files:{included:false,kind:'metadata-only',count:0},
 };
 const migration:LegacyStudyMigrationReport={
  format:LEGACY_STUDY_BACKUP_FORMAT,scope:'study-only',receivedSessions:source.study.sessions.length,
  receivedAnswers:source.study.sessions.reduce((sum,session)=>sum+Object.keys(session.answers).length,0),
  unknownQuestionIds:[],skippedSessions:[],skippedAnswers:[],
 };
 const unknown=new Set<string>();
 for(const session of source.study.sessions){
  const questionIds=session.questionIds.filter(id=>{if(questionById.has(id))return true;unknown.add(id);return false;});
  for(const [questionId,answer] of Object.entries(session.answers)){
   const question=questionById.get(questionId);
   if(!question){migration.skippedAnswers.push({sessionId:session.id,questionId,reason:'unknown-question'});continue;}
   // Empty selections are the original unanswered entries in completed exams.
   if(answer.selected!==''&&!question.options.some(option=>option.id===answer.selected)){
    migration.skippedAnswers.push({sessionId:session.id,questionId,reason:'invalid-option'});continue;
   }
   backup.data.responses.push({session_id:session.id,question_id:questionId,selected:answer.selected,correct:answer.selected!==''&&answer.selected===question.explanation.answer?1:0,answered_at:answer.answeredAt});
  }
  if(!questionIds.length){migration.skippedSessions.push({sessionId:session.id,reason:'no-known-questions'});continue;}
  const currentId=session.questionIds[session.position],keptCurrent=questionIds.indexOf(currentId);
  const position=keptCurrent>=0?keptCurrent:Math.min(questionIds.length-1,session.questionIds.slice(0,session.position).filter(id=>questionById.has(id)).length);
  backup.data.sessions.push({id:session.id,user_id:userId,mode:session.mode,status:session.status,question_ids:JSON.stringify(questionIds),position,started_at:session.startedAt,finished_at:session.finishedAt});
 }
 migration.unknownQuestionIds=[...unknown].sort();
 return {backup,migration};
}
