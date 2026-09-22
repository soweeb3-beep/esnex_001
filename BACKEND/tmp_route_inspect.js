process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const assessmentRoutes = require('./routes/assessmentRoutes');
const standardAssessmentRoutes = require('./routes/standardAssessmentRoutes');
const printRoutes = (router) => {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
};
console.log('assessmentRoutes:', JSON.stringify(printRoutes(assessmentRoutes), null, 2));
console.log('standardAssessmentRoutes:', JSON.stringify(printRoutes(standardAssessmentRoutes), null, 2));
