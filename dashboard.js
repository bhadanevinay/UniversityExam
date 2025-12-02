// dashboard.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ---- Firebase setup ----
const firebaseConfig = {
  apiKey: "AIzaSyCV63GiJXfloVBHK43zrJbeJbKwi2PwMMg",
  authDomain: "study-progress-app-22812.firebaseapp.com",
  projectId: "study-progress-app-22812",
  storageBucket: "study-progress-app-22812.firebasestorage.app",
  messagingSenderId: "728222021200",
  appId: "1:728222021200:web:9d3f12a636330ff3054355",
  measurementId: "G-YDBDVH6BXT",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---- DOM references ----
const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const userAvatarEl = document.getElementById("userAvatar");
const welcomeNameEl = document.getElementById("welcomeName");
const logoutBtn = document.getElementById("logoutBtn");
const subjectsContainer = document.getElementById("subjectsContainer");

const subjectsData = window.SYLLABUS_DATA || [];

let currentUserId = null;

// ========================
//  LocalStorage helpers
// ========================
function getTopicStorageKey(topicId) {
  return `topicStatus:${topicId}`;
}

function isTopicCompleted(topicId) {
  return localStorage.getItem(getTopicStorageKey(topicId)) === "completed";
}

function setTopicCompleted(topicId, completed) {
  if (completed) {
    localStorage.setItem(getTopicStorageKey(topicId), "completed");
  } else {
    localStorage.removeItem(getTopicStorageKey(topicId));
  }
}

// ========================
//  Firestore helpers
// ========================

// doc path: userProgress/{uid}
function getUserProgressDocRef(uid) {
  return doc(db, "userProgress", uid);
}

// Load all completed topics for current user from Firestore
async function loadUserProgressFromFirestore(uid) {
  try {
    const ref = getUserProgressDocRef(uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return {};
    }

    const data = snap.data();
    return data.completedTopics || {};
  } catch (err) {
    console.error("Error loading progress from Firestore:", err);
    return {};
  }
}

// Save single topic change to Firestore
async function saveTopicProgressToFirestore(topicId, completed) {
  if (!currentUserId) return;

  const ref = getUserProgressDocRef(currentUserId);

  try {
    // store as boolean: true = completed, false = not completed
    await setDoc(
      ref,
      {
        completedTopics: {
          [topicId]: completed,
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Error saving topic progress to Firestore:", err);
  }
}

// After Firestore data is loaded, apply to UI
function applyProgressToUI(completedTopicsMap) {
  // Update localStorage from Firestore map
  Object.entries(completedTopicsMap).forEach(([topicId, value]) => {
    const completed = !!value;
    setTopicCompleted(topicId, completed);
  });

  // Update all topic buttons + unit progress
  const allUnitCards = document.querySelectorAll(".unit-card");

  allUnitCards.forEach((unitCard) => {
    const topicButtons = unitCard.querySelectorAll(".topic-status-btn");

    topicButtons.forEach((btn) => {
      const li = btn.closest(".topic-item");
      const topicId = li?.dataset.topicId;
      if (!topicId) return;

      const completed = isTopicCompleted(topicId);
      btn.classList.toggle("status-completed", completed);
      btn.classList.toggle("status-uncompleted", !completed);
      btn.textContent = completed ? "Completed" : "Uncompleted";
    });

    updateUnitProgress(unitCard);
  });
}

// ========================
//  UI helpers
// ========================
function updateUnitProgress(unitElement) {
  const topicButtons = unitElement.querySelectorAll(".topic-status-btn");
  const progressEl = unitElement.querySelector(".unit-progress-value");

  if (!progressEl || topicButtons.length === 0) {
    if (progressEl) progressEl.textContent = "0%";
    return;
  }

  let completedCount = 0;
  topicButtons.forEach((btn) => {
    if (btn.classList.contains("status-completed")) {
      completedCount++;
    }
  });

  const percent = Math.round((completedCount / topicButtons.length) * 100);
  progressEl.textContent = `${percent}%`;
}

function createTopicItem(topic, unitElement) {
  const li = document.createElement("li");
  li.className = "topic-item";
  li.dataset.topicId = topic.id;

  const titleSpan = document.createElement("span");
  titleSpan.className = "topic-title";
  titleSpan.textContent = topic.title;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "topic-status-btn";

  // Initial state from localStorage
  const completed = isTopicCompleted(topic.id);
  if (completed) {
    btn.classList.add("status-completed");
    btn.textContent = "Completed";
  } else {
    btn.classList.add("status-uncompleted");
    btn.textContent = "Uncompleted";
  }

  btn.addEventListener("click", async () => {
    const currentlyCompleted = btn.classList.contains("status-completed");
    const newState = !currentlyCompleted;

    // LocalStorage update
    setTopicCompleted(topic.id, newState);

    // Firestore update
    await saveTopicProgressToFirestore(topic.id, newState);

    // UI update
    btn.classList.toggle("status-completed", newState);
    btn.classList.toggle("status-uncompleted", !newState);
    btn.textContent = newState ? "Completed" : "Uncompleted";

    updateUnitProgress(unitElement);
  });

  li.appendChild(titleSpan);
  li.appendChild(btn);
  return li;
}

function createUnitCard(unit) {
  const unitCard = document.createElement("div");
  unitCard.className = "unit-card";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "unit-header";

  const leftWrap = document.createElement("div");
  leftWrap.className = "unit-header-left";

  const titleSpan = document.createElement("span");
  titleSpan.className = "unit-title";
  titleSpan.textContent = unit.title;

  leftWrap.appendChild(titleSpan);

  const progressBadge = document.createElement("span");
  progressBadge.className = "unit-progress";
  const progressValue = document.createElement("span");
  progressValue.className = "unit-progress-value";
  progressValue.textContent = "0%";
  const progressLabel = document.createElement("span");
  progressLabel.className = "unit-progress-label";
  progressLabel.textContent = "Completed";

  progressBadge.appendChild(progressValue);
  progressBadge.appendChild(progressLabel);

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-chevron-down";

  header.appendChild(leftWrap);
  header.appendChild(progressBadge);
  header.appendChild(icon);

  const topicsList = document.createElement("ul");
  topicsList.className = "unit-topics";

  (unit.topics || []).forEach((topic) => {
    const item = createTopicItem(topic, unitCard);
    topicsList.appendChild(item);
  });

  header.addEventListener("click", () => {
    unitCard.classList.toggle("open");
  });

  unitCard.appendChild(header);
  unitCard.appendChild(topicsList);

  // initial progress
  updateUnitProgress(unitCard);

  return unitCard;
}

function createSubjectCard(subject) {
  const card = document.createElement("div");
  card.className = "subject-card";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "subject-header";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = subject.name;

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-chevron-down";

  header.appendChild(titleSpan);
  header.appendChild(icon);

  const body = document.createElement("div");
  body.className = "subject-body";

  (subject.units || []).forEach((unit) => {
    const unitCard = createUnitCard(unit);
    body.appendChild(unitCard);
  });

  header.addEventListener("click", () => {
    card.classList.toggle("open");
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderSubjects() {
  subjectsContainer.innerHTML = "";
  subjectsData.forEach((subject) => {
    const subjectCard = createSubjectCard(subject);
    subjectsContainer.appendChild(subjectCard);
  });
}

// ========================
//  Boot flow
// ========================

// 1) Render empty skeleton from SYLLABUS_DATA
renderSubjects();

// 2) Auth state + load progress
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUserId = user.uid;

  const displayName = user.displayName || "Vinay";
  const email = user.email || "";
  const photo =
    user.photoURL ||
    "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName);

  userNameEl.textContent = displayName;
  welcomeNameEl.textContent = displayName.split(" ")[0];
  userEmailEl.textContent = email;
  userAvatarEl.src = photo;

  // Load Firestore progress and apply to UI
  const completedMap = await loadUserProgressFromFirestore(currentUserId);
  applyProgressToUI(completedMap);
});

// Logout handler
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Error during logout:", err);
    alert("Failed to logout. Try again.");
  }
});


// ========================
//  Countdown for first paper
// ========================

function startCountdown() {
  const daysEl = document.getElementById("daysLeft");
  const hoursEl = document.getElementById("hoursLeft");
  const minutesEl = document.getElementById("minutesLeft");
  const secondsEl = document.getElementById("secondsLeft");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  // First paper: 15 December 2025 (midnight of that day)
  const target = new Date("2025-12-15T00:00:00+05:30"); // IST

  function update() {
    const now = new Date();
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) {
      daysEl.textContent = "0";
      hoursEl.textContent = "00";
      minutesEl.textContent = "00";
      secondsEl.textContent = "00";
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    daysEl.textContent = days.toString();
    hoursEl.textContent = hours.toString().padStart(2, "0");
    minutesEl.textContent = minutes.toString().padStart(2, "0");
    secondsEl.textContent = seconds.toString().padStart(2, "0");
  }

  update();
  setInterval(update, 1000);
}

startCountdown();
