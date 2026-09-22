const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { Assessment } = require('./models/Assessment');
const escapeRegExp = (string) => String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSubjectKey = (subject) => {
  if (!subject || typeof subject !== 'string') return null;
  const cleaned = subject.trim().toLowerCase();
  const aliasMap = {
    maths: 'maths',
    math: 'maths',
    mathematics: 'maths',
    english: 'english',
    eng: 'english',
    literature: 'english',
    language: 'english',
    ict: 'ict',
    it: 'ict',
    computer: 'ict',
    information: 'ict',
  };
  return aliasMap[cleaned] || cleaned;
};
const compareAssessments = (a,b) => {
  const aHasParts = Array.isArray(a.parts) && a.parts.length > 0;
  const bHasParts = Array.isArray(b.parts) && b.parts.length > 0;
  if (aHasParts !== bHasParts) return aHasParts ? -1 : 1;
  const aPrice=Number(a.price)||0; const bPrice=Number(b.price)||0;
  if(aPrice!==bPrice) return bPrice-aPrice;
  const aParts=Array.isArray(a.parts)?a.parts.length:0; const bParts=Array.isArray(b.parts)?b.parts.length:0;
  if(aParts!==bParts) return bParts-aParts;
  const aDate=new Date(a.updatedAt||a.createdAt||0).getTime();
  const bDate=new Date(b.updatedAt||b.createdAt||0).getTime();
  return bDate-aDate;
};
(async ()=>{
  try{
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/esnex_learning', { serverSelectionTimeoutMS:5000, connectTimeoutMS:5000, socketTimeoutMS:5000 });
    const subject='physics';
    const normalized = normalizeSubjectKey(subject);
    const assessments = await Assessment.find({ type:'global', visibility:true, status:'published', $or:[ {subject:normalized}, {subject:{$regex:new RegExp(`^${escapeRegExp(subject)}$`, 'i')}}, {name:{$regex:new RegExp(`^${escapeRegExp(subject)}$`, 'i')}}, {displayName:{$regex:new RegExp(`^${escapeRegExp(subject)}$`, 'i')}} ] }).lean();
    console.log('found', assessments.length);
    assessments.forEach((a,i)=>{ console.log(i, a._id.toString(), 'subject', a.subject, 'name', a.name, 'parts', Array.isArray(a.parts)?a.parts.length:a.parts, 'price', a.price); });
    const sorted = [...assessments].sort(compareAssessments);
    console.log('sorted order:', sorted.map((a)=>({id:a._id.toString(),parts:Array.isArray(a.parts)?a.parts.length:a.parts,price:a.price})));
    const subjectMatches = assessments.filter((assessment)=>{
      const subjectKey=normalizeSubjectKey(assessment.subject);
      const nameKey=normalizeSubjectKey(assessment.name);
      const displayKey=normalizeSubjectKey(assessment.displayName);
      return subjectKey===normalized||nameKey===normalized||displayKey===normalized;
    });
    console.log('subjectMatches', subjectMatches.length);
    const sel = subjectMatches.length>0 ? [...subjectMatches].sort(compareAssessments)[0] : null;
    console.log('selected', sel?sel._id.toString() : null, Array.isArray(sel?.parts)?sel.parts.length:sel?.parts);
  } catch(e){ console.error(e); } finally{ await mongoose.disconnect(); }
})();
