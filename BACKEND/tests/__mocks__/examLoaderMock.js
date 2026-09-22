const getSubjectConfig = async (subject) => ({
  displayName: subject.charAt(0).toUpperCase() + subject.slice(1),
  timeLimit: 60,
  objective: { parts: [{ parts: [{ name: 'Objective', files: ['objective/questions.json'] }] }] },
});

module.exports = {
  getSubjectConfig,
};
