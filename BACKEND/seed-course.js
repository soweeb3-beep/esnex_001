const fs = require('fs');
const path = require('path');

const coursesFile = path.join(__dirname, 'data', 'courses.json');

const newCourse = {
  "_id": "76oos1loq",
  "title": "Introduction to ITC",
  "description": "from zero to hero",
  "thumbnail": "",
  "subject": "IT",
  "status": "published",
  "price": 1500,
  "level": "Beginner",
  "totalDuration": "3h 45m",
  "category": "IT",
  "rating": 4.7,
  "certificateEnabled": false,
  "instructor": {
    "name": "Ebrima Sowe",
    "avatar": "https://res.cloudinary.com/dl2uffxyl/image/upload/v1778113664/eboy_bkjhmd.png",
    "userId": "nw68r4ybx",
    "bio": ""
  },
  "sections": [
    {
      "_id": "sec_001",
      "title": "Section 1",
      "description": "Introduction to the course",
      "order": 1,
      "objectives": [
        "Understand the fundamentals",
        "Learn core concepts",
        "Practice applications"
      ],
      "lessons": [
        {
          "_id": "lesson_001",
          "title": "Introduction to ITC",
          "videoUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
          "sourceType": "External",
          "thumbnail": "",
          "description": "from zero to hero",
          "notes": "This is your first lesson",
          "duration": "03:45",
          "order": 1,
          "attachments": []
        }
      ],
      "resources": [],
      "qa": [],
      "announcements": [],
      "quizzes": []
    }
  ],
  "students": [],
  "createdAt": "2026-06-25T13:50:50.074Z",
  "updatedAt": "2026-06-25T13:50:50.074Z"
};

const courses = JSON.parse(fs.readFileSync(coursesFile, 'utf8'));
const existingIndex = courses.findIndex(c => c._id === "76oos1loq");
if (existingIndex >= 0) {
  courses[existingIndex] = newCourse;
} else {
  courses.push(newCourse);
}

fs.writeFileSync(coursesFile, JSON.stringify(courses, null, 2));
console.log('✓ Course updated with lessons');
