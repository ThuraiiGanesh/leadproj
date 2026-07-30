// Official Ngee Ann Polytechnic Clubs & Societies Dataset
// Derived from https://www.np.edu.sg/student-life/clubs-societies

const NP_CCAS = [
  // ─── SPECIAL INTEREST ───────────────────────────────────────────
  {
    id: "legaltech_sig",
    name: "NP LegalTech SIG",
    category: "Special Interest",
    school: "ICT",
    description: "Empowering students at the intersection of Artificial Intelligence, Software Engineering, and Legal Discourse.",
    location: "Block 31 (ICT) Level 4, Room 402",
    block_query: "Block+31+Ngee+Ann+Polytechnic",
    commitment: "Medium",
    tags: ["coding", "ai", "law", "tech", "tele bot"],
    exco: [
      { name: "Thurai Ganesh", role: "President", email: "s10234567@connect.np.edu.sg" },
      { name: "Rachel Tan", role: "Vice President", email: "s10234890@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPLegalTechSIG",
      instagram: "@np_legaltech",
      email: "legaltech@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_lt_1",
        title: "Build Your First Legal Tech AI Bot Workshop",
        date: "2026-08-05",
        time: "17:00 - 19:00",
        location: "Blk 31 (ICT) Lvl 4 Room 402",
        block_query: "Block+31+Ngee+Ann+Polytechnic",
        description: "Hands-on session building custom AI assistants for legal document automation and campus navigation.",
        capacity: 45,
        registeredCount: 18
      },
      {
        id: "evt_lt_2",
        title: "LegalTech Hackathon 2026 Info Session",
        date: "2026-08-12",
        time: "16:00 - 18:00",
        location: "Convention Centre LT 68A",
        block_query: "Ngee+Ann+Polytechnic+Convention+Centre",
        description: "Learn about the upcoming inter-poly hackathon, team formation, and prize categories.",
        capacity: 100,
        registeredCount: 42
      }
    ]
  },
  {
    id: "np_developers",
    name: "NP Developers' Club",
    category: "Special Interest",
    school: "ICT",
    description: "The official software engineering and web development community of Ngee Ann Poly.",
    location: "Block 31 (ICT) Level 3, Makerspace",
    block_query: "Block+31+Ngee+Ann+Polytechnic",
    commitment: "High",
    tags: ["coding", "web dev", "app dev", "python", "javascript"],
    exco: [
      { name: "Marcus Lim", role: "President", email: "s10221144@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPDevsClub",
      instagram: "@npdevs",
      email: "npdevs@connect.np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_dev_1",
        title: "Full-Stack Web Dev Bootcamp",
        date: "2026-08-08",
        time: "14:00 - 17:00",
        location: "Blk 31 Lvl 3 Makerspace",
        block_query: "Block+31+Ngee+Ann+Polytechnic",
        description: "Learn Node.js, Express, and modern frontend frameworks for building real-world web apps.",
        capacity: 35,
        registeredCount: 29
      }
    ]
  },
  {
    id: "np_business_society",
    name: "NP Business & Entrepreneurship Society",
    category: "Special Interest",
    school: "BA",
    description: "Fostering entrepreneurial mindsets, startup pitch competitions, and corporate networking for future leaders.",
    location: "Block 72 (BA) Level 2 Innovation Hub",
    block_query: "Block+72+Ngee+Ann+Polytechnic",
    commitment: "Medium",
    tags: ["business", "startup", "leadership", "pitching", "marketing"],
    exco: [
      { name: "Daniel Kwek", role: "President", email: "s10219988@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPBusinessSociety",
      instagram: "@np_business",
      email: "business@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_biz_1",
        title: "NP Venture Pitch Night 2026",
        date: "2026-08-15",
        time: "18:00 - 21:00",
        location: "Blk 72 (BA) Lvl 2 Auditorium",
        block_query: "Block+72+Ngee+Ann+Polytechnic",
        description: "Watch student founders pitch real startup ideas to venture capital judges.",
        capacity: 120,
        registeredCount: 88
      }
    ]
  },
  {
    id: "np_robotics",
    name: "NP Aerospace & Robotics Society",
    category: "Special Interest",
    school: "SOE",
    description: "Designing autonomous drones, competitive robotics, 3D printing, and aerospace engineering projects.",
    location: "Block 37 Aerospace Hub",
    block_query: "Block+37+Ngee+Ann+Polytechnic",
    commitment: "High",
    tags: ["robotics", "engineering", "drones", "hardware", "coding"],
    exco: [
      { name: "Justin Lee", role: "Team Captain", email: "s10245566@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPRobotics",
      instagram: "@np_robotics",
      email: "robotics@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_rob_1",
        title: "Autonomous Drone Racing & Coding Tryouts",
        date: "2026-08-14",
        time: "14:00 - 17:00",
        location: "Blk 37 Hangar Bay",
        block_query: "Block+37+Ngee+Ann+Polytechnic",
        description: "Program micro-drones using OpenCV and race them through obstacle courses.",
        capacity: 40,
        registeredCount: 31
      }
    ]
  },

  // ─── ARTS & CULTURAL ─────────────────────────────────────────────
  {
    id: "np_ambassadors",
    name: "NP Ambassadors",
    category: "Arts & Cultural",
    school: "HMS",
    description: "The flagship student leadership group representing Ngee Ann Poly in institutional events, open houses, and VIP visits.",
    location: "Block 1 (Admin Block) Level 2 Lounge",
    block_query: "Block+1+Ngee+Ann+Polytechnic",
    commitment: "High",
    tags: ["leadership", "public speaking", "hosting", "events", "networking"],
    exco: [
      { name: "Samantha Ho", role: "Head Ambassador", email: "s10214455@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPAmbassadors",
      instagram: "@np_ambassadors",
      email: "ambassadors@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_amb_1",
        title: "NP Open House Student Guide Training",
        date: "2026-08-09",
        time: "10:00 - 14:00",
        location: "Blk 1 Lvl 2 Convention Hall",
        block_query: "Block+1+Ngee+Ann+Polytechnic",
        description: "Public speaking techniques, campus tour hosting, and VIP guest engagement.",
        capacity: 80,
        registeredCount: 64
      }
    ]
  },
  {
    id: "np_dance_crew",
    name: "NP Hip Hop & Dance Crew",
    category: "Arts & Cultural",
    school: "FMS",
    description: "High-energy street dance, choreography jams, and national inter-poly competition performances.",
    location: "Block 73 Dance Studio 1",
    block_query: "Block+73+Ngee+Ann+Polytechnic",
    commitment: "High",
    tags: ["dance", "hiphop", "performing arts", "music", "fitness"],
    exco: [
      { name: "Chloe Teo", role: "Dance Captain", email: "s10228833@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPDanceCrew",
      instagram: "@np_dancecrew",
      email: "dance@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_dnc_1",
        title: "Freshmen Dance Auditions & Jam Session",
        date: "2026-08-06",
        time: "18:00 - 21:00",
        location: "Blk 73 Studio 1",
        block_query: "Block+73+Ngee+Ann+Polytechnic",
        description: "Open floor hip hop jam session and choreography evaluation for new dancers.",
        capacity: 60,
        registeredCount: 52
      }
    ]
  },
  {
    id: "np_voices",
    name: "NP Voices Vocal Ensemble",
    category: "Arts & Cultural",
    school: "FMS",
    description: "A cappella, pop vocals, and choral harmony group showcasing acoustic performances at campus galas.",
    location: "Convention Centre Music Room B",
    block_query: "Ngee+Ann+Polytechnic+Convention+Centre",
    commitment: "Medium",
    tags: ["singing", "music", "performing arts", "vocals"],
    exco: [
      { name: "Lucas Tan", role: "Music Director", email: "s10237711@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPVoices",
      instagram: "@np_voices",
      email: "voices@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_voc_1",
        title: "Acoustic Sunset Concert Rehearsal",
        date: "2026-08-13",
        time: "17:30 - 19:30",
        location: "Convention Centre LT 68B",
        block_query: "Ngee+Ann+Polytechnic+Convention+Centre",
        description: "Vocal warm-ups and harmony arrangement training for the upcoming campus acoustic night.",
        capacity: 40,
        registeredCount: 28
      }
    ]
  },

  // ─── SPORTS & FITNESS ─────────────────────────────────────────────
  {
    id: "np_sports_outdoor",
    name: "NP Outdoor Adventure Club",
    category: "Sports & Fitness",
    school: "HS",
    description: "Rock climbing, kayaking, trekking, obstacle courses, and fitness endurance for outdoor enthusiasts.",
    location: "Block 50 Sports Complex & Climbing Wall",
    block_query: "Block+50+Ngee+Ann+Polytechnic",
    commitment: "Medium",
    tags: ["sports", "fitness", "climbing", "outdoors", "adventure"],
    exco: [
      { name: "Kevin Zhang", role: "Expedition Leader", email: "s10239911@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPAdventureClub",
      instagram: "@np_adventure",
      email: "adventure@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_spo_1",
        title: "Night Climbing & Bouldering Tryouts",
        date: "2026-08-11",
        time: "18:00 - 21:00",
        location: "Blk 50 Outdoor Wall",
        block_query: "Block+50+Ngee+Ann+Polytechnic",
        description: "All skill levels welcome! Harnesses, belay devices, and climbing shoes provided.",
        capacity: 50,
        registeredCount: 41
      }
    ]
  },
  {
    id: "np_badminton",
    name: "NP Badminton Club",
    category: "Sports & Fitness",
    school: "HS",
    description: "Competitive and recreational badminton training for IVP tournaments and friendly campus matches.",
    location: "Block 50 Sports Hall Courts 1-6",
    block_query: "Block+50+Ngee+Ann+Polytechnic",
    commitment: "Medium",
    tags: ["sports", "badminton", "fitness", "tournaments"],
    exco: [
      { name: "Wei Jie Tan", role: "Team Captain", email: "s10229944@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPBadminton",
      instagram: "@np_badminton",
      email: "badminton@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_bad_1",
        title: "Inter-School Badminton Trials",
        date: "2026-08-04",
        time: "17:30 - 20:30",
        location: "Blk 50 Sports Hall",
        block_query: "Block+50+Ngee+Ann+Polytechnic",
        description: "Selection trials for the upcoming POL-ITE games varsity team.",
        capacity: 40,
        registeredCount: 35
      }
    ]
  },

  // ─── COMMUNITY SERVICE ───────────────────────────────────────────
  {
    id: "np_community_service",
    name: "NP Youth Community Advocates",
    category: "Community Service",
    school: "HMS",
    description: "Youth-led volunteering, social impact projects, mental health awareness, and tutoring outreach.",
    location: "Block 58 (HMS) Level 3 Activity Lounge",
    block_query: "Block+58+Ngee+Ann+Polytechnic",
    commitment: "Low",
    tags: ["volunteering", "community", "social impact", "leadership"],
    exco: [
      { name: "Aaliyah Ibrahim", role: "President", email: "s10212233@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPCommunityAdvocates",
      instagram: "@np_advocates",
      email: "community@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_comm_1",
        title: "Campus Mental Wellness Day Volunteers Briefing",
        date: "2026-08-07",
        time: "16:30 - 18:00",
        location: "Blk 58 Lvl 3 Lounge",
        block_query: "Block+58+Ngee+Ann+Polytechnic",
        description: "Join us in organizing wellness booths, peer support activities, and gift distribution.",
        capacity: 60,
        registeredCount: 45
      }
    ]
  },
  {
    id: "np_yep_cambodia",
    name: "NP Youth Expedition Project (YEP)",
    category: "Community Service",
    school: "HMS",
    description: "Overseas and local community service initiatives building schools, teaching literacy, and supporting sustainability.",
    location: "Block 58 Level 2 YEP Hub",
    block_query: "Block+58+Ngee+Ann+Polytechnic",
    commitment: "Medium",
    tags: ["volunteering", "overseas", "yep", "community", "service-learning"],
    exco: [
      { name: "Ryan Goh", role: "Expedition Leader", email: "s10246611@connect.np.edu.sg" }
    ],
    contact: {
      telegram: "t.me/NPYEP",
      instagram: "@np_yep",
      email: "yep@np.edu.sg"
    },
    upcoming_events: [
      {
        id: "evt_yep_1",
        title: "Youth Expedition Project 2026 Info Session",
        date: "2026-08-16",
        time: "17:00 - 18:30",
        location: "Blk 58 Lvl 2 YEP Hub",
        block_query: "Block+58+Ngee+Ann+Polytechnic",
        description: "Learn how to apply for upcoming overseas service-learning trips to Vietnam & Cambodia.",
        capacity: 70,
        registeredCount: 58
      }
    ]
  }
];

module.exports = { NP_CCAS };
