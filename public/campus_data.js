// NP Campus Real Coordinates & 3D WebGL Building Spatial Data

const CAMPUS_LOCATIONS = [
  {
    id: "blk31",
    number: 31,
    name: "Block 31 (InfoComm Technology)",
    school: "School of ICT",
    category: "Academic",
    lat: 1.3330,
    lng: 103.7762,
    icon: "💻",
    color: "#3b82f6",
    glowColor: "rgba(59, 130, 246, 0.8)",
    // 3D Spatial Vector & Bounding Box
    pos3d: { x: 14, y: 0, z: -16 },
    dim3d: { width: 14, height: 18, depth: 10 },
    pinOffset: 12,
    levels: ["Lvl 1 - Cybersecurity Ops Centre & Foyer", "Lvl 2 - Software Dev Labs & SIT Studios", "Lvl 3 - AI & Cloud Innovation Hub", "Lvl 4 - LegalTech SIG Studio & Staff Offices"],
    indoorGuide: [
      { step: 1, text: "Enter Block 31 Main Foyer through the Glass Sliding Doors." },
      { step: 2, text: "Walk past the Cybersecurity Operations Centre (Room 102)." },
      { step: 3, text: "Take Lift B to Level 4." },
      { step: 4, text: "Turn Left down the quiet corridor to Room 402 (NP LegalTech SIG & AI Lab)." }
    ],
    ccasHere: ["NP LegalTech SIG", "NP Developers' Club", "Cybersecurity Club"],
    keywords: ["ict", "infocomm", "tech", "block 31", "blk 31", "sit", "legaltech"]
  },
  {
    id: "blk72",
    number: 72,
    name: "Block 72 (Business & Accountancy)",
    school: "School of BA",
    category: "Academic",
    lat: 1.3324,
    lng: 103.7744,
    icon: "📈",
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.8)",
    pos3d: { x: -16, y: 0, z: 8 },
    dim3d: { width: 16, height: 16, depth: 12 },
    pinOffset: 11,
    levels: ["Lvl 1 - BA Foyer & Atrium Cafe", "Lvl 2 - BA Seminar Rooms 201-215", "Lvl 3 - Business Innovation Hub & Incubator"],
    indoorGuide: [
      { step: 1, text: "Enter Block 72 Atrium near the BA Atrium Cafe." },
      { step: 2, text: "Head towards Central Escalator Bay B and ascend to Level 3." },
      { step: 3, text: "Turn Right past Seminar Room 304." },
      { step: 4, text: "Arrive at Room 310 (NP Entrepreneurship & Business Innovation Hub)." }
    ],
    ccasHere: ["NP Business & Startups SIG", "FinTech Society", "Marketing Club"],
    keywords: ["ba", "business", "accountancy", "block 72", "blk 72", "startups"]
  },
  {
    id: "sports_complex",
    number: 50,
    name: "Block 50 (Sports Complex & Health)",
    school: "Sports & Recreation / HS",
    category: "Sports",
    lat: 1.3342,
    lng: 103.7778,
    icon: "🏸",
    color: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.8)",
    pos3d: { x: 25, y: 0, z: 15 },
    dim3d: { width: 22, height: 12, depth: 16 },
    pinOffset: 9,
    levels: ["Lvl 1 - Track, Field & Swimming Pool", "Lvl 2 - Indoor Multipurpose Gym", "Lvl 3 - Badminton & Martial Arts Courts"],
    indoorGuide: [
      { step: 1, text: "Enter via Block 50 Main Canopy near the Outdoor Running Track." },
      { step: 2, text: "Proceed through the turnstiles into the Central Sports Complex Lobby." },
      { step: 3, text: "Take Escalator A to Level 2 Indoor Gymnasium." },
      { step: 4, text: "Walk past the Fitness Reception to Court 3 (Badminton & Martial Arts)." }
    ],
    ccasHere: ["NP Badminton Club", "NP Adventure Club", "NP Health Sciences Club"],
    keywords: ["sports complex", "swimming pool", "gym", "track", "blk 50", "badminton", "health"]
  },
  {
    id: "blk58",
    number: 58,
    name: "Block 58 (Humanities & Social Sci)",
    school: "School of HMS",
    category: "Academic",
    lat: 1.3333,
    lng: 103.7756,
    icon: "🧠",
    color: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.8)",
    pos3d: { x: 2, y: 0, z: -22 },
    dim3d: { width: 15, height: 14, depth: 10 },
    pinOffset: 10,
    levels: ["Lvl 1 - HMS Foyer & LT 58A-C", "Lvl 2 - Early Childhood Experiential Labs", "Lvl 3 - Psychology Research Suite"],
    indoorGuide: [
      { step: 1, text: "Enter Block 58 Main Foyer near Lecture Theatre 58A." },
      { step: 2, text: "Take Lift A to Level 2." },
      { step: 3, text: "Walk straight down Corridor A past the Student Lounge." },
      { step: 4, text: "Arrive at Room 208 (Psychology & Social Outreach Studio)." }
    ],
    ccasHere: ["NP Community Service Club", "Youth For Sustainable Policy", "Psychology Interest Group"],
    keywords: ["hms", "humanities", "blk 58", "block 58", "lt 58", "community"]
  },
  {
    id: "blk52",
    number: 52,
    name: "Block 52 (Film & Media Studies)",
    school: "School of FMS",
    category: "Academic",
    lat: 1.3330,
    lng: 103.7740,
    icon: "🎬",
    color: "#ec4899",
    glowColor: "rgba(236, 72, 153, 0.8)",
    pos3d: { x: -22, y: 0, z: -10 },
    dim3d: { width: 14, height: 15, depth: 10 },
    pinOffset: 10,
    levels: ["Lvl 1 - Radio Booths & TV Studio A", "Lvl 2 - Video Editing Suites & LT 51A-H", "Lvl 3 - Animation & VFX Soundstage"],
    indoorGuide: [
      { step: 1, text: "Enter Block 52 Media Foyer." },
      { step: 2, text: "Pass Radio Booth 1 and TV Studio A on your left." },
      { step: 3, text: "Take Staircase C to Level 2 Editing Corridor." },
      { step: 4, text: "Arrive at Suite 204 (NP Dance Crew & Media Production Lab)." }
    ],
    ccasHere: ["NP Dance Crew", "NP Media & Film Club", "Radio Broadcast SIG"],
    keywords: ["fms", "film", "media", "block 52", "blk 52", "dance"]
  },
  {
    id: "cc",
    number: 68,
    name: "NP Convention Centre (LT 68A-E)",
    school: "Central Event Auditorium",
    category: "Events",
    lat: 1.3328,
    lng: 103.7748,
    icon: "🏛️",
    color: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.8)",
    pos3d: { x: -4, y: 0, z: -2 },
    dim3d: { width: 18, height: 20, depth: 18 },
    pinOffset: 13,
    levels: ["Lvl 1 - Exhibition Plaza & Atrium", "Lvl 2 - LT 68A & 68B Foyer", "Lvl 3 - LT 68C & Grand Auditorium"],
    indoorGuide: [
      { step: 1, text: "Enter the Convention Centre Main Plaza Entrance." },
      { step: 2, text: "Ascend the Grand Marble Staircase to the Level 2 Auditorium Lobby." },
      { step: 3, text: "Proceed to Door 3 for Lecture Theatre 68C." },
      { step: 4, text: "Arrive at the Orientation & Open House Exhibition Stage." }
    ],
    ccasHere: ["NP Student Union", "Voices Vocal Ensemble", "Performing Arts Council"],
    keywords: ["convention centre", "cc", "lt 68", "auditorium", "events hall", "open house"]
  },
  {
    id: "makan_place",
    number: 50,
    name: "Makan Place Food Court",
    school: "Food & Dining Hub",
    category: "Dining",
    lat: 1.3341,
    lng: 103.7741,
    icon: "🍔",
    color: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.8)",
    pos3d: { x: 10, y: 0, z: 20 },
    dim3d: { width: 18, height: 8, depth: 14 },
    pinOffset: 7,
    levels: ["Ground Floor - Western, Mala, Drinks, Japanese & Halal Stalls"],
    indoorGuide: [
      { step: 1, text: "Enter Makan Place Ground Floor Dining Hall." },
      { step: 2, text: "Air-Conditioned seating is located in the Central Hall." },
      { step: 3, text: "Mala Hotpot is at Stall 5; Western Grill at Stalls 11-12." }
    ],
    ccasHere: ["Post-CCA Dining Hangout"],
    keywords: ["makan place", "food", "canteen", "lunch", "dining"]
  },
  {
    id: "blk1",
    number: 1,
    name: "Block 1 (Admin & Main Library)",
    school: "Central Student Hub",
    category: "Academic",
    lat: 1.3320,
    lng: 103.7750,
    icon: "🎓",
    color: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.8)",
    pos3d: { x: 0, y: 0, z: 12 },
    dim3d: { width: 22, height: 22, depth: 16 },
    pinOffset: 14,
    levels: ["Lvl 1 - Atrium & Student Services Hub", "Lvl 2 - Student Affairs & Career Office", "Lvl 3 - Main Campus Library", "Lvl 4 - Quiet Study Pods"],
    indoorGuide: [
      { step: 1, text: "Enter Block 1 Glass Portal near the Student Services Hub." },
      { step: 2, text: "Take Escalators to Level 3 Main Library Entrance." },
      { step: 3, text: "Tap Student Card at Turnstile Portal." },
      { step: 4, text: "Silent Collaborative Study Pods are located in Wing B." }
    ],
    ccasHere: ["NP Debate Society", "Library Ambassadors"],
    keywords: ["admin", "library", "atrium", "student services", "blk 1", "block 1"]
  }
];

// Graph Nodes for Animated 3D Route Lines
const CAMPUS_GRAPH_3D = {
  "n_blk1": { x: 0, z: 12 },
  "n_cc": { x: -4, z: -2 },
  "n_blk31": { x: 14, z: -16 },
  "n_blk72": { x: -16, z: 8 },
  "n_sports": { x: 25, z: 15 },
  "n_blk58": { x: 2, z: -22 },
  "n_blk52": { x: -22, z: -10 },
  "n_makan": { x: 10, z: 20 }
};
